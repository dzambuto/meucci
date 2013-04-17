proto.route.prototype.subscribe = function() {
	for(var i = 0; i < arguments.length; ++i) {
		this.parent.callbacks.push(this.callback(arguments[i]));
	}
	return this;
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path, callbacks = this.parent.callbacks;
	removeCallbacks(path, arguments, callbacks)
	return this;
};

proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments);
	this.parent.handle(this.path, args);
	this.parent.broadcast(this.path, args, this.sockets);
	return this;
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
	function onSubscribe(path) {
		socket.join(path.path);
	}

	socket.on('subscribe', onSubscribe);

	// TODO - Client (eliminare)
	function onUnsubscribe(path) {
		socket.leave(path.path);
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