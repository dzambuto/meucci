var proto = {};

proto.init = function() {	
  this.procedures = [];
  this.callbacks = [];
  this.plugins = [];
	this.settings = {};
	this.defaultConfiguration();
};

proto.defaultConfiguration = function() {
	var self = this;
	
	this.set('env', process.env.NODE_ENV || 'development');
	
	this.bind('app:mounted', function(parent) {
		var app = self;
		app.parent = parent;
		if(parent.socket) app.socket = parent.socket
		if(parent.io) app.io = parent.io;
	});
};

proto.initSocket = function(socket) {
	var self = this;

	function onEvent(message, done) {
		if(!message.path) return done({'err': 'Invalid message.'});
		
		var options = {
			'path': message.path,
			'args': message.args,
			'rpc': message.rpc,
			'socket': socket,
			'ack': done,
			'client': !proto.listen
		};
		
		var req = self.requestMessage(options)
				, res = self.responseMessage(options);

		self.dispatch(req, res);
	}

	socket.on('event', onEvent);

	this.events(socket);
};

proto.set = function(setting, val){
  if (1 == arguments.length) {
    return this.settings[setting];
  } else {
    this.settings[setting] = val;
    return this;
  }
};

proto.get = function(setting) {
	return this.settings[setting];
};

proto.enable = function(setting){
  return this.set(setting, true);
};

proto.disable = function(setting){
  return this.set(setting, false);
};

proto.enabled = function(setting){
  return !!this.set(setting);
};

proto.disabled = function(setting){
  return !this.set(setting);
};

proto.handle = function(path, args) {
	var options = {
		'path': path,
		'args': args,
		'client': !this.listen
	};
	
	var req = this.requestMessage(options)
			, res = this.responseMessage(options)
			, next = function() {};
	
  for(var i = 0; i < this.callbacks.length; ++i) {
    this.callbacks[i](req, res, next);
  }	
};

proto.dispatch = function(req, res, out) {
	var i = 0
			, stack = req.rpc ? this.plugins.concat(this.procedures) : this.plugins.concat(this.callbacks)
			, self = this;
	
  function next(err) {
    var fn = stack[i++];

    if(!fn || res.messageSent) {
			if(out) return out(err);
	
      if(err) {
				res.error(err);
			}
			else {
				if(req.rpc) {
					res.error('Procedure not found');
				} else { 
					res.broadcast();
					res.done();
				}
			}

			return;
    }

    try {
      if(err) {
        if(fn.length == 4) fn(err, req, res, next);
        else next(err);
      } else if(fn.length == 3) {
        fn(req, res, next);
      } else {
        next();
      }
    } catch(e) {
      next(e);
    }
  }

  next();
};

proto.use = function() {
  return this('*').use.apply(null, arguments);
};

proto.reset = function() {
  this.callbacks = [];
  this.plugins = [];
  this.procedures = [];
  if(this.listeners) this.listeners = {};
  return this;
};

proto.bind = function(eventType, listener, context) {
  this.listeners = this.listeners || {};
  var list = this.listeners[eventType] = this.listeners[eventType] || [];
  list.push([listener, context]);
};

proto.unbind = function(eventType, listener, context) {
  if(!this.listeners || !this.listeners[eventType]) return;
	
  if(!listener) {
    delete this.listeners[eventType];
    return;
  }
	
  var list = this.listeners[eventType], len = list.length;
	
  while (i--) {
    if (listener !== list[i][0]) continue;
    if (context && list[i][1] !== context) continue;
    list.splice(i,1);
  }
	
};

proto.trigger = function(eventType) {
  var args = Array.prototype.slice.call(arguments, 1);
  if(!this.listeners || !this.listeners[eventType]) return;
	
  var list = this.listeners[eventType], len = list.length
	
  for(var i = 0; i < len; i++) {
    list[i][0].apply(list[i][1], args);
  }
};