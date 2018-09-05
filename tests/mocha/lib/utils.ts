export function resetConsoleErrors() {
  if ("reset" in console.error) {
    (console.error as sinon.SinonStub).reset();
  }
}

export const STRICT_DESTRUCTURE_UNDEFINED = Symbol("undefined value");

export class Options {
  private options: {[key: string]: any} = {};

  constructor(aSpecList, aObj) {
    const allowedKeys = new Set();
    const undefinedKeys = new Set();
    for (let spec of aSpecList) {
      let [key, defaultValue] = spec;
      allowedKeys.add(key);
      if (spec.length === 1) {
        undefinedKeys.add(key);
        continue;
      }
      this.options[key] = defaultValue;
    }
    for (let [key, value] of Object.entries(aObj)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Unknown key "${key}"`);
      }
      if (
        value === STRICT_DESTRUCTURE_UNDEFINED &&
          !undefinedKeys.has(key)
      ) continue;
      this.options[key] = value;
      undefinedKeys.delete(key);
    }
    if (undefinedKeys.size !== 0) {
      const sUndefinedKeys = Array.from(undefinedKeys.values()).join(", ");
      throw new Error(
          `The following keys are undefined: ${sUndefinedKeys}`
      );
    }
  }

  get(aKey) {
    if (!this.options.hasOwnProperty(aKey)) {
      throw new Error(`Option "${aKey}" does not exist.`);
    }
    return this.options[aKey];
  }
}

export const destructureOptions = (aSpecList, aObj) => {
  let options = new Options(aSpecList, aObj);
  return options.get.bind(options);
};
