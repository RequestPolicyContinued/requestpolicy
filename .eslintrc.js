module.exports = {
  "env": {
    "es6": true,
  },

  "extends": [
    "plugin:promise/recommended",
  ],

  "parserOptions": {
    "ecmaVersion": 2015,
    "ecmaFeatures": {
    },
  },

  "plugins": [
    "promise",
  ],

  "rules": {
    "promise/avoid-new": "off",
  },
};
