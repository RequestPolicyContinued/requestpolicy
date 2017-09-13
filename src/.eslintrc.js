module.exports = {
  "extends": "../.eslintrc.js",

  "rules": {
    "complexity": ["error", {"max": 25}],
    "guard-for-in": "off",
    "max-depth": ["error", {"max": 6}],
  },
};
