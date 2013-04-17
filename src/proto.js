var proto = {};

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