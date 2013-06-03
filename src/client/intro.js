(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = factory(require('socket.io-client'), require('q'));
  } else if (typeof define === 'function' && define.amd) {
    define('meucci', ['io', 'Q'], factory);
  } else if (typeof angular !== 'undefined' && angular.injector) {
    angular.module('angular.meucci', [])
      .factory('meucci', ['$window', function ($window) {
        return factory($window.io, $window.Q);
      }]);
  } else {
    root.meucci = factory(root.io, root.Q);
  }
}(this, function (io, Q) {
