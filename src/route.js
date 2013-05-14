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