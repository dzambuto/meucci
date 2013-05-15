var io = require('socket.io');
var Q = require('q');

exports = module.exports = createMeucci;

function createMeucci() {
  function meucci(path, sockets) {
    if('string' == typeof path) {
      return new meucci.route(path, sockets, meucci);
    }
    return meucci;
  }

  merge(meucci, proto);
	meucci.init();

  return meucci;
}

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
  return this.route.prototype.use.apply(this('*'), arguments);
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

proto.requestMessage = function(options) {
	if(!options || !options.path) return;
	
	var req = {}
			, done = options.ack;
			
	req.path = options.path;
	req.args = options.args || [];
	req.rpc = options.rpc || false;
	req.app = this;
	req.params = [];
	
	if(options.socket) req.connection = options.socket;
	if(options.res) req.res = options.res;
	
	req.end = function(data) {
		this.res && this.res.messageSent = true;
		done && done({'res': data || true});
		this.connection.disconnect();
	};
	
	return req;
};

proto.responseMessage = function(options) {
	if(!options || !options.path) return;
	
	var res = {}
			, done = options.ack;
			
	res.path = options.path;
	res.args = options.args || [];
	res.rpc = options.rpc || false;
	res.app = this;
	res.params = [];
	
	if(options.socket) res.connection = options.socket;
	if(options.req) res.req = options.res;
	
	res.error = function(err) {
		this.messageSent = true;
		done && done({'err': err || 'Unknown Error.'});
	};

	res.done = function() {
		this.messageSent = true;
		done && done({'res': true});
	};

	res.send = function(data) {
		this.messageSent = true;
		done && done({'res': data || true});
	};

	res.end = function(data) {
		this.messageSent = true;
		done && done({'res': data || true});
		this.connection.disconnect();
	};
	
	res.broadcast = function() {
		var path = this.path
				, args = this.args;
		this.connection.broadcast && this.connection.broadcast.to(path).emit('event', {'path': path, 'args': args});
	};
	
	return res;
};

proto.route = function(path, sockets, parent, options) {
  options = options || {};
  this.path = path;
  this.parent = parent;
  if(sockets) this.sockets = sockets.length ? sockets : [sockets];
  this.regexp = pathtoRegexp(path, this.keys = [], options.sensitive, options.strict);
  this.pattern = (this.keys.length || ~this.path.indexOf('*')) ? true : false;
  return this;
};

proto.route.prototype.use = function() {
  for(var i = 0; i < arguments.length; ++i) {
    this.parent.plugins.push(this.middleware(arguments[i]));
  }
  return this;
};

proto.route.prototype.respond = function() {
  if(!arguments.length) return this;
  this.parent.procedures.push(this.callback(arguments[0]));
  return this;
};

proto.route.prototype.request = function() {	
  var args = Array.prototype.slice.apply(arguments)
  , path = this.path
  , sockets = this.sockets || this.parent.socket;
	
  if(!sockets) return this;
	
  return emitWithPromise('event', {'path': path, 'args': args, 'rpc': true}, sockets);
};

proto.route.prototype.middleware = function(fn) {
  var self = this
  		, arity = fn.length;

	if('function' == typeof fn.dispatch) {
		var app = fn;
		
		self.parent.bind('service:started', function() {
			if(self.parent.socket) app.socket = self.parent.socket
			if(self.parent.io) app.io = self.parent.io;
		});
		
		app.trigger('app:mounted', self.parent);
		
		return function(req, res, next) {
			if(self.match(req.path, req.params)) return app.dispatch(req, res, next);
			next();
		}
	}
	
  if(3 == arity) {
    return function(req, res, next) {
      if(self.match(req.path, req.params)) return fn(req, res, next);
      next();
    };
  }

  if(4 == arity) {
    return function(err, req, res, next) {
      if(self.match(req.path, req.params)) return fn(err, req, res, next);
      next();
    };
  }
};


// TODO - Rewrite it!
proto.route.prototype.callback = function(fn) {
  var self = this;
  var f, ctx;

	if('function' == typeof fn.dispatch) return;
	
  if(fn instanceof Array) {
    f = fn[0];
    ctx = fn[1];
  } else {
    f = fn;
    ctx = null;
  }

  var res = function(req, res, next) {
    req.params = [];
    if(self.match(req.path, req.params)) {
      var nargs = req.params;
			nargs = req.args ? nargs.concat(req.args) : nargs;
			
			if(req.rpc) {
				function done(data) {
					res.send(data);
					return;
				}
				nargs.push(done);
			}
			
			var data = f.apply(ctx, nargs);
			
			if(req.rpc && !res.messageSent) res.send(data);
			if(!req.rpc) return next();
			return data;
    }
		next();
  };

  res.match = function(path, mt) { return mt == f && self.match(path, []); };
  res.path = function(path) { return self.match(path, []); };

  return res;
};

proto.route.prototype.match = function(path, params) {
  var keys = this.keys
  , qsIndex = path.indexOf('?')
  , pathname = ~qsIndex ? path.slice(0, qsIndex) : path
  , m = this.regexp.exec(pathname);

  if (!m) return false;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];

    var val = 'string' == typeof m[i]
    ? decodeURIComponent(m[i])
    : m[i];

    if (key) {
      params[key.name] = undefined !== params[key.name]
      ? params[key.name]
      : val;
      params.push(val);
    } else {
      params.push(val);
    }
  }

  return true;
};

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

// Thanks to TJ Holowaychuk (visionmedia) 
function pathtoRegexp(path, keys, sensitive, strict) {
  if (path instanceof RegExp) return path;
  if (path instanceof Array) path = '(' + path.join('|') + ')';
  path = path
  .concat(strict ? '' : '/?')
  .replace(/\/\(/g, '(?:/')
  .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function(_, slash, format, key, capture, optional){
    keys.push({ name: key, optional: !! optional });
    slash = slash || '';
    return ''
    + (optional ? '' : slash)
    + '(?:'
    + (optional ? slash : '')
    + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
    + (optional || '');
  })
  .replace(/([\/.])/g, '\\$1')
  .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}

function merge(a, b){
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
}

function remoteCall(action, message, socket) {
  var deferred = Q.defer();

  socket.emit(action, message, function(res) {
    if(res.res) deferred.resolve(res.res);
    else deferred.reject(new Error(res.err));
  });

  return deferred.promise;
}

function emitWithPromise(action, message, sockets) {
	
  if(!sockets) {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }
	
  if(!sockets.length) return remoteCall(action, message, sockets);
	
  var promises = [];
  for(var i = 0; i < sockets.length; i++) {
    promises.push(remoteCall(action, message, sockets[i]));
  }

  return Q.all(promises);
}

function emit(action, message, sockets) {
  if(!sockets.length) sockets.emit(action, message);
  else {
    for(var i = 0; i < sockets.length; i++) {
      sockets[i].emit(action, message);
    }
  }
}

function removeCallbacks(path, list, callbacks) {
  var all = true;
	
  for(var i = 0; i < list.length; ++i) {
    var offset = 0, l = callbacks.length;
    for(var j = 0; j < l; ++j) {
      var jo = j - offset;
      var fn = callbacks[jo];
      if(fn.match(path, list[i])) {
        callbacks.splice(jo, 1);
        offset++;
      } else if(fn.path(path)) {
        all = false;
      }
    }
  }
	
  return all;
}