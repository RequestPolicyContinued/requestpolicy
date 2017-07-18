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
    "Services": true,
    "XPCOMUtils": true,

    "clearTimeout": true,
    "console": true,
    "setTimeout": true,
  },

  "parserOptions": {
    "sourceType": "module",
  },
};
