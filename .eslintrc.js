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
    "arrow-body-style": [
      "error",
      "as-needed",
      {
        "requireReturnForObjectLiteral": false,
      }
    ],
    "arrow-parens": ["error", "always"],
    "arrow-spacing": [
      "error",
      {
        "before": true,
        "after": true,
      }
    ],
    "complexity": ["error", {"max": 6}],
    "dot-location": ["error", "object"],
    "eqeqeq": ["error", "always"],
    "function-paren-newline": ["error", "consistent"],
    "generator-star-spacing": ["error", "both"],
    "implicit-arrow-linebreak": ["error", "beside"],
    "indent": [
      "error",
      2,
      {
        "CallExpression": {
          "arguments": 2,
        },
        "FunctionDeclaration": {
          "parameters": 2,
          "body": 1,
        },
        "FunctionExpression": {
          "parameters": 2,
          "body": 1,
        },
        "MemberExpression": 2,
        "SwitchCase": 1,
        "VariableDeclarator": 1,
      },
    ],
    "linebreak-style": ["error", "unix"],
    "max-depth": ["error", {"max": 5}],
    "no-confusing-arrow": ["error", {"allowParens": true}],
    "no-console": [
      "error",
      {
        allow: [
          "dir",
          "error",
        ]
      }
    ],
    "no-extra-parens": [
      "error",
      "all",
      {
        "enforceForArrowConditionals": false,
      },
    ],
    "no-lone-blocks": "error",
    "no-param-reassign": [
      "error",
      {
        "props": true,
      },
    ],
    "prefer-template": "error",
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
    "template-curly-spacing": "error",
    "wrap-iife": ["error", "inside"],
  },
};
