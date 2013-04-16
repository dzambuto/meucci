proto.route.prototype.subscribe = function() {
	var path = this.path
		, sockets = this.sockets || this.parent.socket
		, callbacks = this.parent.callbacks;
	
	for(var i = 0; i < arguments.length; ++i) {
		callbacks.push(this.callback(arguments[i]));
	}
	
	if(!this.keys.length) {
		this.parent.emit('subscribe', path, sockets);
	}
	
	return this;
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path
		, sockets = this.sockets || this.parent.socket
		, callbacks = this.parent.callbacks;
		
	if(removeCallbacks(path, arguments, callbacks)) {
		this.parent.emit('unsubscribe', path, sockets);
	}

	return this;
};

// OK
proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments);
	this.parent.handle(this.path, args);
	this.parent.emit('event', this.path, this.sockets || this.parent.socket, args);
	return this;
};

proto.connect = function(host, options) {
	options = options || {};

	this.socket = io.connect(host, options);
	this.init(this.socket);

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
};

proto.emit = function(action, path, sockets, args) {
	var message = {'path': path}
		, callback = function(res) {};
	
	if(args) message.args = args;

	if(sockets && sockets.length) {
		for(var i = 0; i < sockets.length; i++) {
			sockets[i].emit(action, message, callback);
		}
	} else if(sockets) {
		sockets.emit(action, message, callback);
	}
};

proto.initStorage = function(options) {
	
};