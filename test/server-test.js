var should = require('should');

var protocol = require('../build/protocol')();
var client = require('../build/protocol-client');

var socketURL = 'http://localhost:3000';
var options = {'force new connection': true};

describe('protocol', function() {
	var clients = [], middleware = [], task = [0, 0], taskm = 0;;

	before(function(done) {
		protocol.listen(3000, {log:false});
		
		var md1 = function(req, next) { middleware.push('md1'); next(); };
		protocol('task/:id').use(md1);
		
		protocol('task/create').respond(function(task, res) {
			res(++task);
		});
		
		setTimeout(function() {
			for(var i = 0; i < 2; ++i) {
				clients.push(client());
				clients[i].connect(socketURL, options);
			}
			done();
		}, 30);
	});
	
	afterEach(function(done) {
		middleware = [];
		clients[0].reset()('task/0').unsubscribe();
		clients[1].reset()('task/1').unsubscribe();
		setTimeout(function() {done()}, 30);
	});
	
	it('should subscribe clients to events', function(done) {
		clients[0]('task/0').subscribe();
		clients[1]('task/1').subscribe();
		
		setTimeout(function() {done();}, 30);
	});
	
	it('should broadcast events (client)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			if(task == taskm) done();
		});
		
		setTimeout(function() { clients[1]('task/0').publish(taskm = 8); }, 30);
	});
	
	it('should broadcast events (server 1)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			if(task == taskm) done();
		});
		
		clients[1]('task/1').subscribe(function(task) {
			if(task == taskm) done();
		});
				
		setTimeout(function() { protocol('task/0').publish(taskm = 8); }, 30);
	});
	
	it('should broadcast events (server 2)', function(done) {
		clients[1]('task/create').request(taskm).then(function(task) { if(task == taskm+1) done(); else done(task); })
	});
	
	it('should broadcast events (server 3)', function(done) {
		clients[0]('task/0').subscribe(function(task) {
			if(task == taskm) clients[0]('task/create').request(task).then(function(task) { if(task == taskm+1) done(); else done(task); })
		});
				
		setTimeout(function() { protocol('task/0').publish(taskm = 8); }, 30);
	});
	
	it('should unsubscribe callback (client 1)', function(done) {
		var c1 = function(task) { if(task) done(new Error('task')) };
		var c2 = function(task) { done() };
		
		clients[0]('task/0').subscribe(c1);
		clients[0]('task/0').subscribe(c2);
		
		clients[0]('task/0').unsubscribe(c1);		
		
		setTimeout(function() { protocol('task/0').publish(taskm = 8); }, 30);
	});
	
	it('should unsubscribe callback (client 2)', function(done) {
		var c1 = function(task) { if(task) done(new Error('task')) };
		var c2 = function(task) { done() };
		var c3 = function(task) { done('errore'); }
		
		clients[0]('task/0').subscribe(c1);
		clients[0]('task/0').subscribe(c2);
		clients[1]('task/:id').subscribe(c3);
		
		clients[0]('task/0').unsubscribe(c1);
		clients[0]('task/0').unsubscribe(c2);	
		
		setTimeout(function() { protocol('task/0').publish(taskm = 8); }, 30);
		setTimeout(function() { done(); }, 40);
	});
	
	it('should respond to rpc (client)', function(done) {
		clients[1]('i').subscribe();
		
		setTimeout(function() {
			clients[1]('task/stat').respond(function(stat, res) {
				res(stat++);
			});
			protocol('task/stat', protocol.clients('i')).request(10).then(function(res) { done(); });
		}, 30);
	});
});