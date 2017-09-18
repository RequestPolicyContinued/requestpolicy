module.exports = {
  "extends": "../../src/.eslintrc.js",

  "globals": {
    "browser": true,
    "LegacyApi": true,

    "Cc": true,
    "Ci": true,
    "Cm": true,
    "Cr": true,
    "Cu": true,
    "ComponentsID": true,
    "require": true,
    "Services": true,
    "XPCOMUtils": true,

    "console": true,
  },

  "parserOptions": {
    "sourceType": "module",
  },
};
