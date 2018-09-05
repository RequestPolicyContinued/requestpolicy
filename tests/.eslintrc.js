module.exports = {
  "extends": "../.eslintrc.js",

  "rules": {
    "max-len": ["error", 100, {
      "ignoreUrls": true,
    }],
    "new-cap": "off",
    "no-unused-vars": ["error"],
    "strict": "off",
  },
};
