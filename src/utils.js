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

function remoteCall(action, message, socket) {
	var deferred = Q.defer();

	socket.emit(action, message, function(res) {
		if(res.res) deferred.resolve(res.res);
		else deferred.reject(new Error(res.err));
	});

	return deferred.promise;
}

function emitWithPromise(action, message, sockets) {
	
	if(!sockets) {
		var deferred = Q.defer();
		deferred.resolve();
		return deferred.promise;
	}
	
	if(!sockets.length) return remoteCall(action, message, sockets);
	
	var promises = [];
	for(var i = 0; i < sockets.length; i++) {
		promises.push(remoteCall(action, message, sockets[i]));
	}

	return Q.all(promises);
}

function emit(action, message, sockets) {
	if(!sockets.length) sockets.emit(action, message);
	else {
		for(var i = 0; i < sockets.length; i++) {
			sockets[i].emit(action, message);
		}
	}
}

function removeCallbacks(path, list, callbacks) {
	var all = true;
	
	for(var i = 0; i < list.length; ++i) {
		var offset = 0, l = callbacks.length;
		for(var j = 0; j < l; ++j) {
			var jo = j - offset;
			var fn = callbacks[jo];
			if(fn.match(path, list[i])) {
				callbacks.splice(jo, 1);
				offset++;
			} else if(fn.path(path)) {
				all = false;
			}
		}
	}
	
	return all;
}