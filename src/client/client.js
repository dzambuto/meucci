proto.route.prototype.subscribe = function() {
  var path = this.path
  , sockets = this.sockets || this.parent.socket
  , callbacks = this.parent.callbacks;
	
  for(var i = 0; i < arguments.length; ++i) {
    callbacks.push(this.callback(arguments[i]));
  }
	
  if(!this.pattern) {
    return emitWithPromise('subscribe', {'path': path}, sockets);
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
  this.initSocket(this.socket);

  return io;
};

proto.events = function(socket) {
	var self = this;
	
  function onConnect() {
    self.trigger('connection:up', socket);
  }
	
  socket.on('connect', onConnect);
	
  function onDisconnect() {
    self.trigger('connection:down', socket);
  }

  socket.on('disconnect', onDisconnect);
	
  function onConnectError(reason) {
    self.trigger('connection:failed', reason, socket);
  }
	
  socket.on('connect_failed', onConnectError);
};

proto.initStorage = function(options) {
	
};