function createProtocol() {
	function protocol(path, sockets) {
		if('string' == typeof path) {
			return new protocol.route(path, sockets, protocol);
		}
		return protocol;
	}

	merge(protocol, proto);
	
	protocol.procedures = [];
	protocol.callbacks = [];
	protocol.plugins = [];

	return protocol;
}