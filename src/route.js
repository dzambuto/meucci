proto.route = function(path, sockets, parent, options) {
	options = options || {};
	this.path = path;
	this.parent = parent;
	if(sockets) this.sockets = sockets.length ? sockets : [sockets];
	this.regexp = pathtoRegexp(path, this.keys = [], options.sensitive, options.strict);
	return this;
};

// OK
proto.route.prototype.use = function() {
	for(var i = 0; i < arguments.length; ++i) {
		this.parent.plugins.push(this.middleware(arguments[i]));
	}
	return this;
};

// OK
proto.route.prototype.respond = function() {
	if(!arguments.length) return this;
	this.parent.procedures.push(this.callback(arguments[0]));
	return this;
};

// OK
proto.route.prototype.request = function() {	
	var args = Array.prototype.slice.apply(arguments)
		, path = this.path
		, sockets = this.sockets || this.parent.socket;
	
	if(!sockets) return this;
	
	return emitWithPromise('event', {'path': path, 'args': args, 'rpc': true}, sockets);
};

// OK
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

// OK
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

// OK
// Thanks TJ
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