"use strict";

function isPull({
  legacyLastStorageChange,
  webextLastStorageChange,
}) {
  if (!webextLastStorageChange) return false;
  if (!legacyLastStorageChange) return true;
  return new Date(webextLastStorageChange) > new Date(legacyLastStorageChange);
}

module.exports.getFullStorageDirection = function({
  legacySideInitialFullStorage,
  webextSideInitialFullStorage,
}) {
  return isPull({
    legacyLastStorageChange: legacySideInitialFullStorage.lastStorageChange,
    webextLastStorageChange: webextSideInitialFullStorage.lastStorageChange,
  }) ? "pull" : "push";
};
