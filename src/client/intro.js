(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = factory(require('socket.io-client'), require('q'));
  } else if (typeof define === 'function' && define.amd) {
    define('meucci', ['io', 'Q'], factory);
  } else if (typeof angular !== 'undefined' && angular.injector) {
    angular.module('meucci.angular', [])
      .provider('meucci', function () {
        var address = 'http://localhost'
          , client = factory(root.io, root.Q);

        this.setAddress = function(newAddress) {
          address = newAddress;
        }

        this.$get = function() {
          return client.connect(address);
        }
      });
  } else {
    root.meucci = factory(root.io, root.Q);
  }
}(this, function (io, Q) {
