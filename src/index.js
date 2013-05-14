function createMeucci() {
  function meucci(path, sockets) {
    if('string' == typeof path) {
      return new meucci.route(path, sockets, meucci);
    }
    return meucci;
  }

  merge(meucci, proto);
	meucci.init();

  return meucci;
}