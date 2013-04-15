var should = require('should');
var protocol = require('../build/protocol')();

describe('protocol', function() {
	describe('protocol("topic")', function() {
		it('should be an instance of protocol.route', function(done){
			protocol('topic').should.be.an.instanceOf(protocol.route);
			done();
		});
	});
	
	describe('protocol("topic/:id/:method").match', function() {
		it('should return an array of params', function(done) {
			var params = []
			protocol('topic/:id/:id').match('topic/123w/create', params);
			params.should.have.length(2);
			done();
		});
	});
	
	describe('protocol("add/:a/:b").callback(fn)', function() {
		var fn = function(a, b) { return a + b; };
		var res = protocol('add/:a/:b').callback(fn);
		
		it('should have fn property equals to original function', function(done) {
			res.should.have.property('match');
			res.match.should.be.an.instanceOf(Function);
			done();
		});
		
		it('should perform when path matched', function(done){
			res('add/1/1', []).should.be.equal('11');
			done();
		});
		
		it('should not perform when path dont match', function(done){
			(res('add/1/1/3', []) == undefined).should.true;
			done();
		});
	});
	
	describe('protocol("topic").subscribe(fn1, fn2, ...)', function(){
		var fn1 = function(a, b) { return a + b; };
		var fn2 = function(a, b) { return a - b; };
		var fn3 = [fn1, null];
		
		it('should accept plain functions', function(done){
			protocol('add/:a/:b').subscribe(fn1, fn2);
			protocol.callbacks.should.have.length(2);
			done()
		});
		
		it('should accept function/context pair', function(done){
			protocol('add/:a/:b').subscribe(fn3);
			protocol.callbacks.should.have.length(3);
			done()
		});
	});
	
	describe('protocol("topic").unsubscribe(fn1, fn2, ...)', function(){
		var fn1 = function(a, b) { return a + b; };
		var fn2 = function(a, b) { return a - b; };
		var fn3 = function(a, b) { return a - b; };
		
		before(function(done) {
			protocol.reset();
			protocol('add/:a/:b').subscribe(fn1);
			protocol('add/:a/:b').subscribe(fn2);
			protocol('add/:a/:b').subscribe([fn1, null]);
			protocol('add/:a/:b').subscribe(fn3);
			done();
		});
		
		it('should accept a single function', function(done){
			protocol('add/:a/:b').unsubscribe(fn2);
			protocol.callbacks.should.have.length(3);
			done()
		});
		
		it('should accept multiple functions', function(done){
			protocol('add/:a/:b').unsubscribe(fn1);
			protocol.callbacks.should.have.length(1);
			done()
		});
	});
	
	describe('protocol("topic").publish(data1, data2, ...)', function(){
		var counter = 0;
		var fn1 = function() { counter++; };
		var fn2 = function() { counter-- };
		var fn3 = function(a) { if(a == 1) counter++; else counter--; };
		var obj = {data: 10, fn: function(a) {counter += this.data; }};
		var fn4 = [obj.fn, obj];
		var fn5 = function(a, b) { counter = Number(a)*b; };
		var fn6 = function(a, b, c, d) { counter = Number(a)+Number(b)+c+d; };
		
		before(function(done) {
			protocol.reset();
			protocol('add/1').subscribe(fn1, [fn1, null]);
			protocol('add/2').subscribe(fn2);
			protocol('add/3').subscribe(fn4);
			protocol('add/:a').subscribe(fn3);
			protocol('mul/:a').subscribe(fn5);
			protocol('add/:a/:b').subscribe(fn6);
			done();
		});
		
		beforeEach(function(done){
			counter = 0;
			done();
		});
		
		after(function(done) {
			protocol.reset();
			done();
		});
		
		it('should perform only local subscribers 1', function(done){
			protocol('add/1').publish();
			counter.should.be.equal(3);
			done()
		});
		
		it('should perform only local subscribers 2', function(done){
			protocol('add/2').publish();
			counter.should.be.equal(-2);
			done()
		});
		
		it('should perform only local subscribers 3', function(done){
			protocol('add/3').publish();
			counter.should.be.equal(9);
			done()
		});
		
		it('should perform only local subscribers 4', function(done){
			protocol('mul/3').publish(4);
			counter.should.be.equal(12);
			done()
		});
		
		it('should perform only local subscribers 5', function(done){
			protocol('add/3/3').publish(4, 5);
			counter.should.be.equal(15);
			done()
		});
		
		it('should not perform anything', function(done){
			protocol('add/2/3/create').publish();
			counter.should.be.equal(0);
			done()
		});
		
	});
	
	describe('protocol("topic").use and .dispatch', function(){
		var counter = [];
		var md1 = function(req, next) { counter.push('md1'); next(); };
		var md2 = function(err, req, next) { counter.push('md2-err'); next(err); };
		var md3 = function(req, next) { counter.push('md3'); next(); };
		var fn1 = function() { counter.push('fn1'); };
		
		afterEach(function(done) {
			counter = [];
			done();
		});
		
		it('should add element in protocol.plugins', function(done){
			protocol('topic1').use(md1, md2);
			protocol('topic2').use(md3).subscribe(fn1);
			protocol.plugins.should.have.length(3);
			done();
		});
		
		it('should dispatch a request', function(done){
			protocol.dispatch({path: 'topic1', args: [], params: []}, function(res) { 
				res.should.have.property('res');
				res.res.should.be.true;
				counter.should.have.length(1);
				counter[0].should.be.equal('md1');
				done(); 
			});
		});
		
		it('should dispatch a request and trigger subscribers', function(done){
			protocol.dispatch({path: 'topic2', args: [], params: []}, function(res) { 
				res.should.have.property('res');
				res.res.should.be.true;
				counter.should.have.length(2);
				counter[0].should.be.equal('md3');
				counter[1].should.be.equal('fn1');
				done(); 
			});
		});
		
		it('should dispatch a request and parameters', function(done){
			var md4 = function(req, next) { 
				req.params.should.have.property('id');
				req.params.id.should.be.equal('4');
				req.params.should.have.property('method');
				req.params.method.should.be.equal('create');
				next();
			};
			
			protocol('topic/:id/:method').use(md4);
			
			protocol.dispatch({path: 'topic/4/create', args: [], params: []}, function(res) { 
				res.should.have.property('res');
				res.res.should.be.true;
				done(); 
			});
		});
		
		it('should dispatch a request and handle errors', function(done){
			var md5 = function(req, next) { 
				counter.push('md5');
				next('error');
			};
			
			var md6 = function(err, req, next) {
				counter.push('md6-err');
				next(err);
			}
			
			protocol('err').use(md5, md6);
			
			protocol.dispatch({path: 'err', args: [], params: []}, function(res) { 
				counter.should.have.length(2);
				res.should.have.property('err');
				res.err.should.be.equal('error');
				done(); 
			});
		});
		
	});
	
	describe('protocol("topic").methods', function(){
		var counter = 0;
		var fn1 = function() { counter++; };
		var fn2 = function() { counter-- };
		var fn3 = function(a) { if(a == 1) counter++; else counter--; };
		
		beforeEach(function(done){
			counter = 0;
			done();
		});
		
		it('should be chainable', function(done){
			protocol('add/1').subscribe(fn1).subscribe(fn2).publish().unsubscribe(fn2).publish();
			counter.should.be.equal(1);
			done();
		});
	});
});