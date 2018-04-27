"use strict";

function isPull({
  legacyLastStorageChange,
  webextLastStorageChange,
}) {
  if (!webextLastStorageChange) return false;
  if (!legacyLastStorageChange) return true;
  return new Date(webextLastStorageChange) > new Date(legacyLastStorageChange);
}

export function getFullStorageDirection({
  legacySideInitialFullStorage,
  webextSideInitialFullStorage,
}) {
  return isPull({
    legacyLastStorageChange: legacySideInitialFullStorage.lastStorageChange,
    webextLastStorageChange: webextSideInitialFullStorage.lastStorageChange,
  }) ? "pull" : "push";
};
