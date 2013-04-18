proto.route.prototype.subscribe = function() {
	var path = this.path
		, sockets = this.sockets || this.parent.socket
		, callbacks = this.parent.callbacks;
	
	for(var i = 0; i < arguments.length; ++i) {
		callbacks.push(this.callback(arguments[i]));
	}
	
	if(!this.pattern) {
		emitWithPromise('subscribe', {'path': path}, sockets);
	}
	
	return emitWithPromise('subscribe', {'path': path}, undefined);
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path
		, sockets = this.sockets || this.parent.socket
		, callbacks = this.parent.callbacks;
		
	if(removeCallbacks(path, arguments, callbacks)) {
		return emit('unsubscribe', {'path': path}, sockets);
	}

	return this;
};

// OK
proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments)
		, path = this.path
		, sockets = this.sockets || this.parent.socket;
	this.parent.handle(this.path, args);
	if(!sockets) return this;
	return emitWithPromise('event', {'path': path, 'args': args}, sockets);
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
	
	function onConnect() {
		self.trigger('connected', socket);
	}
	
	socket.on('connect', onConnect);
	
	function onDisconnect() {
		self.trigger('disconnected', socket);
	}

	socket.on('disconnect', onDisconnect);
	
	function onConnectError(reason) {
		self.trigger('connection:failed', reason, socket);
	}
	
	socket.on('connect_failed', onConnectError);
};

proto.initStorage = function(options) {
	
};