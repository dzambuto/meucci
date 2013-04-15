proto.route.prototype.subscribe = function() {
	var sockets = this.sockets || this.parent.socket, callbacks = this.parent.callbacks, callback = function(res) {};
	
	for(var i = 0; i < arguments.length; ++i) {
		callbacks.push(this.callback(arguments[i]));
	}
	
	if(!this.keys.length) {
		if(sockets.length) {
			for(var j = 0; j < sockets.length; j++) {
				sockets[j].emit('subscribe', { 'path': this.path }, callback);
			}
		} else sockets.emit('subscribe', { 'path': this.path }, callback);
	}
	
	return this;
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path, sockets = this.sockets || this.parent.socket, callbacks = this.parent.callbacks, all = true, callback = function(res) {};
	
	for(var i = 0; i < arguments.length; ++i) {
		var offset = 0, l = callbacks.length;
		for(var j = 0; j < l; ++j) {
			var jo = j - offset;
			var fn = callbacks[jo];
			if(fn.match(path, arguments[i])) {
				callbacks.splice(jo, 1);
				offset++;
			} else if(fn.path(path)) {
				all = false;
			}
		}
	}
	
	if(all) {
		if(sockets.length) {
			for(var k = 0; k < sockets.length; k++) {
				sockets[k].emit('unsubscribe', { 'path': this.path }, callback);
			}
		} else sockets.emit('unsubscribe', { 'path': this.path }, callback);
	}

	return this;
};

// OK
proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments);
	this.parent.handle(this.path, args);
	this.parent.emit(this.path, args, this.sockets || this.parent.socket);
	return this;
};

// OK
proto.route.prototype.request = function() {	
	var args = Array.prototype.slice.apply(arguments);
	var promises = [], path = this.path, sockets = this.sockets || this.parent.socket;
	
	if(!sockets.length) return remoteCall(path, args, sockets);
	
	for(var i = 0; i < sockets.length; i++) {
		promises.push(remoteCall(path, args, sockets[i]));
	}

	return Q.all(promises);
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

proto.emit = function(path, args, sockets) {
	var callback = function(res) {};
	if(sockets && sockets.length) {
		for(var i = 0; i < sockets.length; i++) {
			sockets[i].emit('event', {'path': path, 'args': args}, callback);
		}
	} else if(sockets) {
		sockets.emit('event', {'path': path, 'args': args}, callback);
	}
};

proto.initStorage = function(options) {
	
};