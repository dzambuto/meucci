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