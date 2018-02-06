function createPathAliasProxy() {
  const Module = require("module");
  const proxy = Proxy.revocable(Module.prototype.require, {
    apply(target, thisArg, argumentsList) {
      // hack require(). https://stackoverflow.com/a/42648141
      // eslint-disable-next-line no-param-reassign
      argumentsList[0] = argumentsList[0].
          replace(/^bootstrap\//, "content/bootstrap/");
      return Reflect.apply(target, thisArg, argumentsList);
    },
  });

  const originalRequire = Module.prototype.require;
  Module.prototype.require = proxy.proxy;
  return {
    revoke() {
      Module.prototype.require = originalRequire;
      proxy.revoke();
    },
  };
}

module.exports = {
  createPathAliasProxy,
};
