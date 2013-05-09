var should = require('should');
var meucci = require('../build/meucci');

describe('meucci', function() {
  describe('meucci("topic")', function () {
    
    it('is an instance of meucci.route', function(){
      var server = meucci();
      server('topic').should.be.an.instanceOf(server.route);
    });
    
    describe('#subscribe(fn1, fn2, ...)', function () {
      var fn1 = function(a, b) { return a + b; };
      var fn2 = function(a, b) { return a - b; };
      var fn3 = [fn1, null];
		
      it('accepts plain functions', function(){
        var server = meucci();
        server('add/:a/:b').subscribe(fn1, fn2);
        server.callbacks.should.have.length(2);
      });
		
      it('accepts function/context pair', function(){
        var server = meucci();
        server('add/:a/:b').subscribe(fn1, fn2);
        server('add/:a/:b').subscribe(fn3);
        server.callbacks.should.have.length(3);
      });
    });
    
    describe('#unsubscribe(fn1, fn2, ...)', function () {
      var fn1 = function(a, b) { return a + b; };
      var fn2 = function(a, b) { return a - b; };
      var fn3 = function(a, b) { return a - b; };
		
      var server = meucci();
		
      before(function() {
        server('add/:a/:b').subscribe(fn1);
        server('add/:a/:b').subscribe(fn2);
        server('add/:a/:b').subscribe([fn1, null]);
        server('add/:a/:b').subscribe(fn3);
      });
		
      it('accepts a single function', function(){
        server('add/:a/:b').unsubscribe(fn2);
        server.callbacks.should.have.length(3);
      });
		
      it('accepts multiple functions', function(){
        server('add/:a/:b').unsubscribe(fn1);
        server.callbacks.should.have.length(1);
      });
    });
    
    describe('#publish(data1, data2, ...)', function () {
      var counter = 0;
      var fn1 = function() { counter++; };
      var fn2 = function() { counter-- };
      var fn3 = function(a) { if(a == 1) counter++; else counter--; };
      var obj = {data: 10, fn: function(a) {counter += this.data; }};
      var fn4 = [obj.fn, obj];
      var fn5 = function(a, b) { counter = Number(a)*b; };
      var fn6 = function(a, b, c, d) { counter = Number(a)+Number(b)+c+d; };
		
      var server = meucci();
		
      before(function() {
        server('foo/1').subscribe(fn1, [fn1, null]);
        server('foo/2').subscribe(fn2);
        server('foo/3').subscribe(fn4);
        server('foo/:a').subscribe(fn3);
        server('mul/:a').subscribe(fn5);
        server('foo/:a/:b').subscribe(fn6);
      });
		
      beforeEach(function(){
        counter = 0;
      });
		
      after(function() {
        server.reset();
      });
      
      describe('when there is a callback with no context', function () {
        describe('and it is explicitly null', function () {
          it('calls all the subscribed callbacks', function(){
            server('foo/1').publish();
            counter.should.be.equal(3);
          });
        });
        
        describe('and it is not referenced at all', function () {
          it('calls all the subscribed callbacks', function(){
            server('foo/2').publish();
            counter.should.be.equal(-2);
          });
        });
      });
      
      describe('when there is a callback with a context', function () {
        it('gets the context', function(){
          server('foo/3').publish();
          counter.should.be.equal(9);
        });
      });
      
      describe('when there is a parameter and an argument is passed', function () {
        it('concatenates the argument to the params in the callback', function(){
          server('mul/3').publish(4);
          counter.should.be.equal(12);
        });
      });
      
      describe('when there are two parameters and two arguments are passed', function () {
        it('concatenates the argument to the params in the callback', function () {
          server('foo/3/3').publish(4, 5);
          counter.should.be.equal(15);
        });
      });
      
      describe('when the topic does not exist', function () {
        it('does not perform anything', function(){
          server('foo/2/3/create').publish();
          counter.should.be.equal(0);
        });
      });
    });
    
    describe('#use() and #dispatch()', function () {
      var counter = [];
      var md1 = function(req, next) { counter.push('md1'); next(); };
      var md2 = function(err, req, next) { counter.push('md2-err'); next(err); };
      var md3 = function(req, next) { counter.push('md3'); next(); };
      var fn1 = function() { counter.push('fn1'); };
		
      var server = meucci();
		
      afterEach(function() {
        counter = [];
      });
		
      it('adds an element in meucci.plugins', function(){
        server('topic1').use(md1, md2);
        server('topic2').use(md3).subscribe(fn1);
        server.plugins.should.have.length(3);
      });
		
      it('dispatches a request', function(){
        server.dispatch({path: 'topic1', args: [], params: []}, function(res) { 
          res.should.have.property('res');
          res.res.should.be.true;
          counter.should.have.length(1);
          counter[0].should.be.equal('md1');
        });
      });
		
      it('dispatches a request and triggers to subscribers', function(){
        server.dispatch({path: 'topic2', args: [], params: []}, function(res) { 
          res.should.have.property('res');
          res.res.should.be.true;
          counter.should.have.length(2);
          counter[0].should.be.equal('md3');
          counter[1].should.be.equal('fn1');
        });
      });
		
      it('dispatches a request with parameters', function(){
        var md4 = function(req, next) { 
          req.params.should.have.property('id');
          req.params.id.should.be.equal('4');
          req.params.should.have.property('method');
          req.params.method.should.be.equal('create');
          next();
        };
			
        server('topic/:id/:method').use(md4);
			
        server.dispatch({path: 'topic/4/create', args: [], params: []}, function(res) { 
          res.should.have.property('res');
          res.res.should.be.true;
        });
      });
		
      it('dispatches a request and handle errors', function(){
        var md5 = function(req, next) { 
          counter.push('md5');
          next('error');
        };
			
        var md6 = function(err, req, next) {
          counter.push('md6-err');
          next(err);
        }
			
        server('err').use(md5, md6);
			
        server.dispatch({path: 'err', args: [], params: []}, function(res) { 
          counter.should.have.length(2);
          res.should.have.property('err');
          res.err.should.be.equal('error');
        });
      });
    });
  });
  
  describe('meucci("topic/:id/:method").match', function() {
    it('returns an array of parameters', function() {
      var server = meucci()
      , params = [];
				
      server('topic/:id/:id').match('topic/123w/create', params);
      params.should.have.length(2);
    });
  });
	
  describe('meucci("add/:a/:b").callback(fn)', function() {
    var fn = function(a, b) { return a + b; };
		
    it('has the fn property that equals to the original function', function() {
      var server = meucci()
      , res = server('add/:a/:b').callback(fn);
				
      res.should.have.property('match');
      res.match.should.be.an.instanceOf(Function);
    });
		
    it('performs when the path matches', function(){
      var server = meucci()
      , res = server('add/:a/:b').callback(fn);
				
      res('add/1/1', []).should.be.equal('11');
    });
		
    it('does not perform when the path does not match', function(){
      var server = meucci()
      , res = server('add/:a/:b').callback(fn);
				
      should.not.exist(res('add/1/1/3', []));
    });
  });
});