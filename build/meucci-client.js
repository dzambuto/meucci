(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = factory(require('socket.io-client'), require('q'));
  } else if (typeof define === 'function' && define.amd) {
    define('meucci', ['io', 'Q'], factory);
  } else {
    root.protocol = factory(root.io, root.Q);
  }
}(this, function (io, Q) {

function createMeucci() {
  function meucci(path, sockets) {
    if('string' == typeof path) {
      return new meucci.route(path, sockets, meucci);
    }
    return meucci;
  }

  merge(meucci, proto);
	
  meucci.procedures = [];
  meucci.callbacks = [];
  meucci.plugins = [];

  return meucci;
}

var proto = {};

proto.handle = function(path, args) {
  for(var i = 0; i < this.callbacks.length; ++i) {
    this.callbacks[i](path, args);
  }	
};

proto.rpc = function(path, args, done) {	
  var i = 0, self = this;

  function next(res) {		
    var fn = self.procedures[i++];

    if(!fn) {
      if(res) return done({'res': res});
      return done({'err' : 'Procedure not found.'});	
    }
	
    try {
      if(res) return done(res);
      fn(path, args, next);
    } catch(e) {
      next({'err': e});
    }
  }

  next();
};

proto.dispatch = function(req, done) {
  var i = 0, rpc = req.rpc, self = this;
  function next(err) {
    var fn = self.plugins[i++];
	
    if(!fn) {
      if(err) return done ? done({'err': err}) : false;
      if(rpc) return self.rpc(req.path, req.args, done);
      self.handle(req.path, req.args);
      if(self.broadcast) self.broadcast(req.path, req.args, req.connection);
      return done ? done({'res': true}) : true;
    }
	
    try {
      if(err) {
        if(fn.length == 3) fn(err, req, next);
        else next(err);
      } else if(fn.length < 3) {
        fn(req, next);
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
  var self = this;
  var arity = fn.length;

  if(2 == arity) {
    return function(req, next) {
      if(self.match(req.path, req.params)) return fn(req, next);
      next();
    };
  }

  if(3 == arity) {
    return function(err, req, next) {
      if(self.match(req.path, req.params)) return fn(err, req, next);
      next();
    };
  }
};


// TODO - Rewrite it!
proto.route.prototype.callback = function(fn) {
  var self = this;
  var f, ctx;

  if(fn instanceof Array) {
    f = fn[0];
    ctx = fn[1];
  } else {
    f = fn;
    ctx = null;
  }

  var res = function(path, args, next) {
    var params = [];
    if(self.match(path, params)) {
      var nargs = params.concat(args || []);
      next && nargs.push(next);
      return f.apply(ctx, nargs);
    }
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

  return createMeucci;
}));