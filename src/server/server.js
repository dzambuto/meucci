proto.route.prototype.subscribe = function() {
	for(var i = 0; i < arguments.length; ++i) {
		this.parent.callbacks.push(this.callback(arguments[i]));
	}
	return this;
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path, callbacks = this.parent.callbacks;
	
	for(var i = 0; i < arguments.length; ++i) {		
		var offset = 0, l = callbacks.length;
		for(var j = 0; j < l; ++j) {
			var jo = j - offset;
			var fn = callbacks[jo];
			if(fn.match(path, arguments[i])) {
				callbacks.splice(jo, 1);
				offset++;
			}
		}
	}

	return this;
};

proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments);
	this.parent.handle(this.path, args);
	// TODO - Client (emette evento event)
	this.parent.broadcast(this.path, args, this.sockets);
	return this;
};

proto.route.prototype.request = function() {
	if(!this.sockets) return this;

	var args = Array.prototype.slice.apply(arguments);
	var promises = [];
	
	for(var i = 0; i < this.sockets.length; i++) {
		var deferred = Q.defer();
	
		this.sockets[i].emit('event', { 'path': this.path, 'args': args, 'rpc': true }, function(message) {
			if(message.res) deferred.resolve(message.res);
			else deferred.reject(new Error(message.err));
		});
	
		promises.push(deferred.promise);
	}

	return Q.all(promises);
};

proto.listen = function(host, options) {
	var self = this; 
	options = options || {};

	this.io = io.listen(host, options);
	this.io.sockets.on('connection', function(socket) {
		self.init(socket);
	});

	return io;
};

proto.init = function(socket) {
	var self = this;

	function onEvent(message, done) {
		var req = {};		
		// Init request object
		req.connection = socket;
		req.app = self;
		req.params = [];

		// send, end, error function
		req.error = function(err) {
			done({'err': err || 'Unknown Error.'});
		};

		req.done = function() {
			done({'res': true});
		};

		req.send = function(data) {
			done({'res': data || true});
		};

		req.end = function(data) {
			done({'res': data || true});
			this.connection.disconnect();
		};

		// Parse message data
		// @param path, args
		if(message.path && message.args) {
			req.path = message.path;
			req.args = message.args;
			req.rpc = message.rpc || false;
		}
		else {
			return done({err: 'Invalid message.'});
		}

		self.dispatch(req, done);
	}

	socket.on('event', onEvent);

	function onDisconnect() {
	}

	socket.on('disconnect', onDisconnect);

	// TODO - Client (eliminare)
	function onSubscribe(path, done) {
		socket.join(path.path);
		done(true);
	}

	socket.on('subscribe', onSubscribe);

	// TODO - Client (eliminare)
	function onUnsubscribe(path, done) {
		socket.leave(path.path);
		done(true);
	}

	socket.on('unsubscribe', onUnsubscribe);
};

proto.broadcast = function(path, args, sockets) {
	if(sockets && sockets.length) {
		for(var i = 0; i < sockets.length; i++) {
			sockets[i].emit('event', {'path': path, 'args': args});
		}
	} else if(sockets) {
		sockets.broadcast.to(path).emit('event', {'path': path, 'args': args});
	} else if(this.io) {
		this.io.sockets.in(path).emit('event', {'path': path, 'args': args});
	}
};

proto.clients = function(path) {
	if(this.io) return this.io.sockets.clients(path) || [];
	return [];
};