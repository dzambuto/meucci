var io = require('socket.io');
var Q = require('q');

exports = module.exports = createProtocol;

function createProtocol() {
	function protocol(path, sockets) {
		if('string' == typeof path) {
			return new protocol.route(path, sockets, protocol);
		}
		return protocol;
	}

	merge(protocol, proto);
	
	protocol.procedures = [];
	protocol.callbacks = [];
	protocol.plugins = [];

	return protocol;
}

proto = {};

// OK
proto.handle = function(path, args) {
	for(var i = 0; i < this.callbacks.length; ++i) {
		this.callbacks[i](path, args);
	}	
};

// OK
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

// OK (server dependency)
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

// OK
proto.use = function() {
	return this('*').use.apply(null, arguments);
};

// OK
proto.reset = function() {
	this.callbacks = [];
	this.plugins = [];
	this.procedures = [];
	return this;
};

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

proto.route.prototype.subscribe = function() {
	for(var i = 0; i < arguments.length; ++i) {
		this.parent.callbacks.push(this.callback(arguments[i]));
	}
	return this;
};

proto.route.prototype.unsubscribe = function() {
	var path = this.path, callbacks = this.parent.callbacks;
	
	for(var i = 0; i < arguments.length; ++i) {		
		var offset = 0, l = callbacks.length;
		for(var j = 0; j < l; ++j) {
			var jo = j - offset;
			var fn = callbacks[jo];
			if(fn.match(path, arguments[i])) {
				callbacks.splice(jo, 1);
				offset++;
			}
		}
	}

	return this;
};

proto.route.prototype.publish = function() {
	var args = Array.prototype.slice.apply(arguments);
	this.parent.handle(this.path, args);
	// TODO - Client (emette evento event)
	this.parent.broadcast(this.path, args, this.sockets);
	return this;
};

proto.route.prototype.request = function() {
	if(!this.sockets) return this;

	var args = Array.prototype.slice.apply(arguments);
	var promises = [];
	
	for(var i = 0; i < this.sockets.length; i++) {
		var deferred = Q.defer();
	
		this.sockets[i].emit('event', { 'path': this.path, 'args': args, 'rpc': true }, function(message) {
			if(message.res) deferred.resolve(message.res);
			else deferred.reject(new Error(message.err));
		});
	
		promises.push(deferred.promise);
	}

	return Q.all(promises);
};

proto.listen = function(host, options) {
	var self = this; 
	options = options || {};

	this.io = io.listen(host, options);
	this.io.sockets.on('connection', function(socket) {
		self.init(socket);
	});

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

	// TODO - Client (eliminare)
	function onSubscribe(path, done) {
		socket.join(path.path);
		done(true);
	}

	socket.on('subscribe', onSubscribe);

	// TODO - Client (eliminare)
	function onUnsubscribe(path, done) {
		socket.leave(path.path);
		done(true);
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

// utility
// thanks TJ
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

// Thanks TJ
function merge(a, b){
	if (a && b) {
    	for (var key in b) {
    		a[key] = b[key];
      	}
    }
    return a;
}

function remoteCall(path, args, socket) {
	var deferred = Q.defer();

	socket.emit('event', { 'path': path, 'args': args, 'rpc': true }, function(message) {
		if(message.res) deferred.resolve(message.res);
		else deferred.reject(new Error(message.err));
	});

	return deferred.promise;
}