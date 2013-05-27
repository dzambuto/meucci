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
		if (this.res) this.res.messageSent = true;
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
