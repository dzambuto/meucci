var should = require('should');
var protocol = require('../build/protocol');
var client = require('../build/protocol-client');

describe('protocol', function() {
	var socketURL = 'http://localhost:3000'
		, options = {'force new connection': true}
		, clients = []
		, middleware = []
		, task = [0, 0]
		, taskm = 0
		, counter = 0
		, server = protocol();
		

	before(function(done) {
		var md1 = function(req, next) { middleware.push('md1'); next(); };
		server('task/:id').use(md1);
		
		server('task/create').respond(function(task, res) {
			res(++task);
		});
		
		server.bind('service:started', function() {
			clients.forEach(function(client) {
				client.connect(socketURL, options);
			});
		});
		
		for(var i = 0; i < 2; ++i) {
			clients.push(client());
			clients[i].bind('connection:up', function() {
				if(++counter > 1) done();
			});
		}
    
    	server.listen(3000, { 'log' : false });
	});
	
	afterEach(function() {
		middleware = [];
		clients[0].reset()('task/0').unsubscribe()
		clients[1].reset()('task/1').unsubscribe()
	});
	
	
	
	it('should broadcast events (client)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			task.should.equal(taskm);
      	  	done();
		}).then(function(res) {
			clients[1]('task/0').publish(taskm = 8);
		});
	});
	
	it('should broadcast events (server 1)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			task.should.equal(taskm);
      	  	done();
		}).then(function(res) {
			return clients[1]('task/1').subscribe(function(task) {
				task.should.equal(taskm);
	      	  	done();
			});
		}).then(function(res) {
			server('task/0').publish(taskm = 8);
		});
	});
	
	it('should broadcast events (server 2)', function(done) {
		clients[1]('task/create')
			.request(taskm)
			.then(function(task) { 
				if(task == taskm+1) done(); 
				else done(task); 
			});
	});
	
	it('should broadcast events (server 3)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			if(task == taskm) {
				clients[0]('task/create')
				.request(task)
				.then(function(task) { 
					if(task == taskm+1) done(); 
					else done(task); 
				});
			}
		}).then(function(res) {
			server('task/0').publish(taskm = 8);
		});
	});
	
	it('should unsubscribe callback (client 1)', function(done) {
		var c1 = function(task) { if(task) done(new Error('task')) };
		var c2 = function(task) { done() };
		
		clients[0]('task/0').subscribe(c1)
		.then(function(res) {
			return clients[0]('task/0').subscribe(c2);
		})
		.then(function(res) {
			clients[0]('task/0').unsubscribe(c1);
			server('task/0').publish(taskm = 8);
		});
	});
	
	it('should unsubscribe callback (client 2)', function(done) {
		var c1 = function(task) { done(new Error('task')) };
		var c2 = function(task) { done(new Error('task')) };
		var c3 = function(task) { done(new Error('task')); }
		
		clients[0]('task/0').subscribe(c1)
		.then(function(res) {
			return clients[0]('task/0').subscribe(c2);
		})
		.then(function(res) {
			return clients[1]('task/:id').subscribe(c3);
		})
		.then(function(res) {
			clients[0]('task/0').unsubscribe(c1);
			clients[0]('task/0').unsubscribe(c2);
			server('task/0').publish(taskm = 8);
			done()
		});
	});
	
	it('should respond to rpc (client)', function(done) {
		clients[1]('task/stat').respond(function(stat, res) {
			res(++stat);
		});
		
		clients[1]('i').subscribe()
		.then(function(res) {
			return server('task/stat', server.clients('i')).request(10);
		})
		.then(function(res) {
			if(res == 11) done()
		});
	});
	
});