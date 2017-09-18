module.exports = {
  "env": {
    "es6": true,
  },

  "extends": [
    "eslint:recommended",
    "google",
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
    "arrow-parens": "off",
    "complexity": ["error", {"max": 6}],
    "eqeqeq": ["error", "always"],
    "linebreak-style": ["error", "unix"],
    "max-depth": ["error", {"max": 5}],
    "no-console": [
      "error",
      {
        allow: [
          "dir",
          "error",
        ]
      }
    ],
    "no-extra-parens": ["error", "all"],
    "promise/avoid-new": "off",
    "quotes": [
      "error",
      "double",
      {
        "allowTemplateLiterals": true,
      }
    ],
    "require-jsdoc": "off",
    "semi": ["error", "always"],
    "strict": ["error", "global"],
    "wrap-iife": ["error", "inside"],
  },
};
