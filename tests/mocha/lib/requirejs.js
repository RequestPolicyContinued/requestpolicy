const process = require("process");
const requirejs = require("requirejs");

const cwd = process.cwd();
requirejs.config({
  baseUrl: `${cwd}/build/legacy/non-ui-testing/webextension/`,
});

module.exports = (paths) => new Promise((resolve, reject) => {
  requirejs(paths, resolve);
});
