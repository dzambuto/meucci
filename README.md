![image](http://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Antonio_Meucci.jpg/220px-Antonio_Meucci.jpg)

# meucci

Simple and distributed pub/sub for browsers and node.js

	meucci('tasks/:id').use(tasks.validate, tasks.store);
	meucci('tasks/:id').subscribe(tasks.show);
	meucci('tasks/1').publish(task);
	meucci('tasks/create').respond(tasks.create);
	meucci('tasks/create').request(task);
				

## Example
Start a server:

	var meucci = require('meucci')
		, app = meucci();
		
	server.listen(8000);
	
	server('messages').use(filterSpams);
	
Create a client:

	<script type='text/javascript' src='meucci.js'></script>
	<script type='text/javascript'>

		var client = meucci();
		
		client.connect('http://localhost:8000/');
		
		client('messages').subscribe(function(message) {
			alert(message);
		});
	
	</script>
	
Publish a message:

	client('messages').publish('Hello world!');
	
## Dependencies

meucci depends on two mainstream libraries: [socket.io](https://github.com/LearnBoost/socket.io) and [q](https://github.com/kriskowal/q).

## Installation

In a node.js environment just issue

```
$ npm install meucci
```

For the browser you can pick the `build/meucci-client.js` file, or whether you are a [bower](https://github.com/bower/bower) user, just issue

```
$ bower install meucci
```

## API

### meucci.connect(host [, options])
Creates a new connection to `host` and returns a new socket. If called more than once it overrides the existing socket. The `options` parameter holds the options you want to pass to  `socket.io`.

### meucci(path [, sockets])
It defines a `path` for an array of `sockets`. 

	meucci('tasks');
	meucci('tasks/:id');
	meucci('tasks/:id/:method?');
	meucci('tasks/:id/delete');
	meucci('*');

It returns an instance of `meucci.route`. In case there are no sockets added, the events are broadcast only across the local environment or through `meucci.socket`, if it has been instantiated beforehand with `meucci.connect`.

### meucci.use(callback [, callback])
Same as `meucci('*').use(callback)`.

### meucci.bind(event, listener [, context])
It binds the `listener` to the `event`. Those are the exposed events:

	meucci.bind('connection:up', function(socket) {});
	meucci.bind('connection:down', function(socket) {});
	meucci.bind('connection:failed', function(reason) {});

### meucci.unbind(event [, listener, context])
Deletes the `listener` from the `event`. When there are no listeners specified, it deletes all the `event`'s callbacks.

### meucci.reset()
**Utility.** It deletes all the plugins, subscribers and remote methods previously loaded. No communication with the server left.

### route
It represents a `path` and holds all the main methods. The `route` object holds besides the `path` an array of sockets, if specified within `meucci`.

### route.subscribe(callback [, callback …])
It links a callback to the `route`.

	meucci('tasks/1').subscribe();
	meucci('tasks/1/create').subscribe(callback);
	meucci('tasks/:id').subscribe([context callback]);
	
When `path` is a pattern (i.e. filled with wildcards), it cannot catch event coming from the server but only from the client.

It also subscribes the callback to all the previously registered `sockets`.

### route.publish(data [, data …])
This function publishes data into the `route`.

	meucci('tasks/1/delete').publish();
	meucci('tasks/2/update').publish(task);
	meucci('tasks/3/changed').publish(task).fail(handleError);

It's not possible to use wildcards. It first bubbles through the local environment, then to the server and eventually to all the clients subscribed to `path`.

I returns a promise, whose methods are: `then`, `fail` and all the other supported methods from the [q library](https://github.com/kriskowal/q). The promise is employed to handle the results of the action.

When there is an error, `fail` takes a callback with an error as the only argument. In case of linked `sockets` it propagates it to them.

### route.respond(callback)
It binds a callback to the `route` and fetches a `request`.

	meucci('local/stat').respond(stat);
	meucci('local/theme').respond(theme);

Wildcards are not allowed.

### route.request(data [, data …])
It calls a `respond` method on the server.

	meucci('tasks/create').request(task);
	meucci('tasks/1/followers').request().then(callback, handleError);

Wildcards are not allowed and it returns a promise. If any `sockets` are linked it propagates to them.

### route.use(callback [, callback])
It registers a plugin to the `route`.

	meucci('tasks/:id/*').use(tasks.validate)
	meucci('tasks/:id/:method').use(notification)
	
Plugins are called only for incoming server events. Plugins are useful to manipulate the request, filtering it, or blocking.

## Routing
The `route` object makes use of the same convention of string interpolation employed in the famous [Express](https://github.com/visionmedia/express) framework, so patterns like `:id`, `:id?` and `*` just work.

Here are some examples of correct usage. 

	// Wrong
	publish('tasks/:id').publish(data);
	
	// Correct
	publish('tasks/1').publish(data);

`subscribe` accepts a pattern but they are not bound to the server.

	// Only client
	meucci('tasks/1/:method').subscribe(callback);
	
	// Client and server
	meucci('tasks/1/update').subscribe(callback);

`meucci` depends upon [socket.io](https://github.com/LearnBoost/socket.io), that doesn't currently support any pattern matching. This feature has been already requested. ([Issue 434](https://github.com/LearnBoost/socket.io/issues/434)).

### Event bubbling
Plugins only work when called remotely, either from server or remote client. The `subscribe` methods doesn't register the event remotely if the `path` contains a pattern. The `publish` method bubbles the event locally first, calling the registered subscribers and then the remote ones, telling the server to call the subsequent remote registered clients as well.

### Callbacks e plugins
`subscribe` accepts functions whose signatures are like that:
 
 	function([param …,] data [, data …]) {}
 
 where `param` is the value extracted from `path` and `data` are the arguments passed to `publish`.

	meucci('tasks/:id/:method').subscribe(function(id, method, attr) {})
	meucci('tasks/1/create').publish({'text': 'This is a task'})

`use` accepts functions which can be signed in two ways, likewise Express:

	// Canonical
	function(req, next) {}
	
	// Error handler
	function(err, req, next) {}

The `req` object contains: 

1. `req.path` - the request path
2. `req.args` - arguments passed to the request (used in `publish` and `request`)
3. `req.rpc` - tells if a request has been made through `request`
2. `req.params` - array of parameters extracted from `path`
3. `req.connection` - the socket which the request is coming from
4. `req.done`, `req.error` - functions for telling the outcome of the request to the caller
5. `req.end` - function that closes the connection

`request` accepts functions whose signatures are like that: 

	function([param, …] data [, data …] done) {}

where `done` is the function that return the outcome of the request.

### Pattern matching
Here are some examples of supported patterns:

Explicit Path.

	meucci('date');
	
Path with a parameter. The extracted segments are available at `req.params[N]` or `req.params.NAME`.

	meucci('tasks/:id');

Path with several parameters, for instance `tasks/1/create` and `tasks/2/delete`.

	meucci('tasks/:id/:method');
	
Path with a mandatory parameter and an optional one, like `tasks/1` and `tasks/1/delete`.

	meucci('tasks/:id/:method?');
	
Path with wildcards, `tasks/1` and `tasks/2/comment/5`.

	meucci('tasks/*');
	
Path with regular expressions.

	meucci(\/tasks\/(\d+)\);

## Licence
(The MIT License)

Copyright &copy; 2013 Daniele Zambuto <<mailto:daniele.zambuto@gmail.com>>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
