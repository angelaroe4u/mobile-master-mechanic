// Intentional no-op shim.
// Metro resolves react-native-url-polyfill (and similar packages) to this
// file so the polyfill never executes and cannot break URL.prototype getters.
module.exports = {};
