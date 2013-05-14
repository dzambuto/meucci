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
	var args = Array.prototype.slice.apply(arguments)
	, path = this.path;
	
	this.parent.handle(path, args);
	this.parent.broadcast(this.path, args, this.sockets);
	return this;
};

proto.listen = function(host, options) {
	var self = this; 
	options = options || {};

	this.io = io.listen(host, options, function() {
		self.trigger('service:started');
	});
	
	this.io.sockets.on('connection', function(socket) {
		self.initSocket(socket);
		self.trigger('client:connected', socket);
	});

	return io;
};

proto.events = function(socket) {
	var self = this;
	
	function onDisconnect() {
		self.trigger('client:disconnected', socket);
	}

	socket.on('disconnect', onDisconnect);

	function onSubscribe(path, done) {
		socket.join(path.path);
		done({'res': true});
	}

	socket.on('subscribe', onSubscribe);

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