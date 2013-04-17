## protocol

Semplice pub/sub distribuito per browser e node.

	protocol('tasks/:id').use(tasks.validate, tasks.store)
	protocol('tasks/:id').subscribe(tasks.show)
	protocol('tasks/1').publish(task)
	protocol('tasks/create').respond(tasks.create)
	protocol('tasks/create').request(task)

## Example
Avvia il server:

	var protocol = require('protocol')
		, app = protocol();
		
	server.listen(8000);
	
	server('messages').use(filterSpams);
	
Crea un client:

	var client = protocol();
	
	client.connect('http://localhost:8000/');
	
	client('messages').subscribe(function(message) {
		alert(message);
	});
	
Pubblica un messaggio:

	client('messages').publish('Hello world!');
	

## API

### protocol.connect(host [, options])
Crea una nuova connessione con `host`. Restituisce il socket creato. Più chiamate sovrascrivono il socket esistente. Il parametro `options` contiene le opzioni da passare a `socket.io`.

### protocol(path [, sockets])
Definisce un `path` dato un array di uno o più `sockets`. 

	protocol('tasks')
	protocol('tasks/:id')
	protocol('tasks/:id/:method?')
	protocol('tasks/:id/delete')
	protocol('*')

Restituisce un oggetto `protocol.route`. Se non viene specificato nessun sockets, gli eventi sono propagati in locale e/o tramite `protocol.socket`, se instanziato precedentemente tramite il metodo `protocol.connect`.

### protocol.use(callback [, callback])
Equivale a `protocol('*').use(callback)`.

### protocol.reset()
**Metodo di comodo.** Cancella tutti i plugins, subscribers e metodi remoti caricati. Nessuna comunicazione al server.

### route
Rappresenta un `path` e possiede tutti i metodi fondamentali. L'oggetto `route` contiene oltre al `path` anche un array di sockets, se specificati nella chiamata a `protocol`.

### route.subscribe(callback [, callback …])
Associa una o più callbacks al `path` di `route`.

	protocol('tasks/1').subscribe()
	protocol('tasks/1/create').subscribe(callback)
	protocol('tasks/:id').subscribe([context callback])
	
Quando il `path` è un pattern (cioè contiene wildcards), l'evento non è comunicato al server e le callbacks associate sono registrate in locale. Se sono associati `sockets`, propaga l'evento subscribe su tutti.

### route.publish(data [, data …])
Pubblica dei dati nel `path` di `route`.

	protocol('tasks/1/delete').publish()
	protocol('tasks/2/update').publish(task)
	protocol('tasks/3/changed').publish(task).fail(handleError)

Non può essere usata con pattern. Si propaga prima in locale, poi al server e poi a tutti gli altri clients iscritti al `path`. 

Restituisce una promise. I metodi utilizzabili sono: `then`, `fail`, ecc.. La promise può essere utilizzata per conoscere l'esito dell'azione. In caso di errore, `fail` ha come argomento l'errore. Se sono associati `sockets`, propaga l'evento su tutti. 

### route.respond(callback)
Associa una callback al `path` di `route`.

	protocol('local/stat').respond(stat)
	protocol('local/theme').respond(theme)

Non può essere usata con pattern. L'evento non è propagato al server.

### route.request(data [, data …])
Chiama un metodo del server.

	protocol('tasks/create').request(task)
	protocol('tasks/1/followers').request().then(callback, handleError)

Non può essere usato con pattern. Restituisce una promise. Se sono associati `sockets`, propaga l'evento a tutti i sockets.

### route.use(callback [, callback])
Associa un plugin al `path` di `route`.

	protocol('tasks/:id/*').use(tasks.validate)
	protocol('tasks/:id/:method').use(notification)
	
I plugins sono chiamati soltanto per eventi o chiamate che provengono dal server. I plugins possono modificare la richiesta, bloccarla, filtrarla, ecc.. 

## Routing
L'oggetto `route` utilizza la stessa conversione stringa->regexp di Express, quindi cose come `:id`, `:id?` e `*` funzionano.

L'utilizzo dei pattern cambia in base all'operazione che si vuole eseguire, quindi non sempre le cose andranno come ci si aspetta. `publish` e `request` non accettano pattern. 

	// Errato
	publish('tasks/:id').publish(data)
	// Corretto
	publish('tasks/1').publish(data)

`subscribe` accetta pattern ma non li comunica al server.

	// Locale
	protocol('tasks/1/:method').subscribe(callback)
	// Locale e remoto
	protocol('tasks/1/update').subscribe(callback)

`protocol` si basa sugli eventi di `socket.io`, che non supportano pattern al momento. La feature è stata chiesta ufficialmente ([Issue 434](https://github.com/LearnBoost/socket.io/issues/434)).

### Propagazione degli eventi
I plugins sono utilizzati soltanto per richieste che arrivano dal server. Il metodo `subscribe` non registra l'evento in remoto se il `path` è un pattern. Il metodo `publish` propaga l'evento prima in locale, chiamando i subscribers registrati e poi in remoto, avvisando il server che a sua volta lo propaga ai client registrati. .

### Callbacks e plugins
`subscribe` accetta come argomento funzioni con la seguente signature:
 
 	function([param …,] data [, data …]) {}
 
 dove `param` indica il valore del campo estratto dal `path` e `data` sono gli argomenti di `publish`.

	protocol('tasks/:id/:method').subscribe(function(id, method, attr) {})
	protocol('tasks/1/create').publish({'text': 'This is a task'})

`use` accetta come argomento due tipi di funzioni:

	// normal
	function(req, next) {}
	// handle errors
	function(err, req, next) {}

L'oggetto `req` ha al suo interno: 

1. `req.path` - percorso della richiesta
2. `req.args` - argomenti della richiesti (usati in `publish` e `request`)
3. `req.rpc` - indica una chiamata remota
2. `req.params` - array dei parametri estratti da `path`
3. `req.connection` - socket che ha effettuato la richiesta
4. `req.done`, `req.error` - funzioni per comunicare l'esito della richiesta al client/server
5. `req.end` - funzione che chiude la connessione

`request` accetta come argomento funzioni con la seguente signature:

	function([param, …] data [, data …] done) {}

dove `done` è la funzione che restituisce il risultato del metodo remoto.

### Pattern
Alcuni esempi di pattern supportati.

Path esplicito.

	protocol('date')
	
Path con parametro richiesto. I segmenti estratti sono disponibili in `req.params[N]` o in `req.params.NAME`.

	protocol('tasks/:id')

Path con alcuni parametri, ad esempio `tasks/1/create` e `tasks/2/delete`.

	protocol('tasks/:id/:method')
	
Path con un parametro opzionale e uno richiesto, ad esempio `tasks/1` e `tasks/1/delete`.

	protocol('tasks/:id/:method?')
	
Path con wildcards, ad esempio `tasks/1`, `tasks/2/comment/5`.

	protocol('tasks/*')
	
Path con espressioni regolari.

	protocol(\/tasks\/(\d+)\)

## Licenza
(The MIT License)

Copyright (c) 2012 Daniele Zambuto <<mailto:daniele.zambuto@gmail.com>>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.