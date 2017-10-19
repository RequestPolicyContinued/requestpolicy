module.exports.STRICT_DESTRUCTURE_UNDEFINED = Symbol("undefined value");

// eslint-disable-next-line complexity
function Options(aSpecList, aObj) {
  const allowedKeys = new Set();
  const undefinedKeys = new Set();
  const options = {};
  for (let spec of aSpecList) {
    let [key, defaultValue] = spec;
    allowedKeys.add(key);
    if (spec.length === 1) {
      undefinedKeys.add(key);
      continue;
    }
    options[key] = defaultValue;
  }
  for (let [key, value] of Object.entries(aObj)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown key "${key}"`);
    }
    if (
      value === module.exports.STRICT_DESTRUCTURE_UNDEFINED &&
        !undefinedKeys.has(key)
    ) continue;
    options[key] = value;
    undefinedKeys.delete(key);
  }
  if (undefinedKeys.size !== 0) {
    const sUndefinedKeys = Array.from(undefinedKeys.values()).join(", ");
    throw new Error(
        `The following keys are undefined: ${sUndefinedKeys}`
    );
  }
  this._options = options;
}

Options.prototype.get = function(aKey) {
  if (!this._options.hasOwnProperty(aKey)) {
    throw new Error(`Option "${aKey}" does not exist.`);
  }
  return this._options[aKey];
};

module.exports.Options = Options;
module.exports.destructureOptions = (...args) => {
  let options = new Options(...args);
  return options.get.bind(options);
};
