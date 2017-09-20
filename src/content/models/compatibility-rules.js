/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import {MapOfSets} from "lib/classes/map-of-sets";

// =============================================================================
// CompatibilityRules
// =============================================================================

export const CompatibilityRules = (function() {
  const self = {};

  // ---------------------------------------------------------------------------
  // Extensions compatibility
  // ---------------------------------------------------------------------------

  let extensionCompatibilitySpec;

  let addonIdsToNames = new Map();
  let extRulesToIds = new MapOfSets();
  let whitelistedBaseUrisToIds = new MapOfSets();
  let topLevelDocTranslationRules = new Map();

  function updateExtensionCompatibility() {
    browser.management.getAll().
        then(extensionInfos => {
          ({
            addonIdsToNames,
            extRulesToIds,
            whitelistedBaseUrisToIds,
            topLevelDocTranslationRules,
          } = extensionInfosToCompatibilityRules(extensionInfos));
          return;
        }).
        catch(e => {
          console.error("Could not update extension compatibility. Details:");
          console.dir(e);
        });
  }

  function maybeForEach(aObj, aPropName, aCallback) {
    if (aObj.hasOwnProperty(aPropName)) {
      aObj[aPropName].forEach(aCallback);
    }
  }

  function extensionInfosToCompatibilityRules(aExtensionInfos) {
    let addonIdsToNames = new Map();
    let extRulesToIds = new MapOfSets();
    let whitelistedBaseUrisToIds = new MapOfSets();
    let topLevelDocTranslationRules = new Map();

    const enabledAddons = aExtensionInfos.map(addon => addon.enabled);
    let idsToExtInfos = new Map();
    for (let addon of enabledAddons) {
      idsToExtInfos.set(addon.id, addon);
      addonIdsToNames.set(addon.id, addon.name);
    }

    extensionCompatibilitySpec.forEach(spec => {
      const enabledAddonIds = spec.ids.filter(id => idsToExtInfos.has(id));
      if (enabledAddonIds.length === 0) {
        return;
      }
      maybeForEach(spec, "rules", rule => {
        for (let id of enabledAddonIds) {
          extRulesToIds.addToSet(rule, id);
        }
      });
      maybeForEach(spec, "whitelistedBaseURIs", baseUri => {
        for (let id of enabledAddonIds) {
          whitelistedBaseUrisToIds.addToSet(baseUri, id);
        }
      });
      maybeForEach(spec, "topLevelDocTranslationRules", rules => {
        rules.forEach(rule => {
          let [uriToBeTranslated, translatedUri] = rule;
          if (topLevelDocTranslationRules.has(uriToBeTranslated)) {
            console.error("Multiple definitions of traslation rule " +
                `"${uriToBeTranslated}".`);
          }
          topLevelDocTranslationRules.set(uriToBeTranslated, {
            extensionIds: enabledAddonIds,
            translatedUri,
          });
        });
      });
    });

    return {
      addonIdsToNames,
      extRulesToIds,
      whitelistedBaseUrisToIds,
      topLevelDocTranslationRules,
    };
  }

  // ---------------------------------------------------------------------------
  // Application compatibility
  // ---------------------------------------------------------------------------

  let appCompatSpec;
  let appCompatRules = [];
  let appName;

  function updateApplicationCompatibility() {
    browser.runtime.getBrowserInfo().
        then(appInfo => {
          appName = appInfo.name;
          appCompatRules = getAppCompatRules(appName);
          return;
        }).
        catch(e => {
          console.error("Could not update app compatibility.");
          console.dir(e);
        });
  }

  function getAppCompatRules(appName) {
    let rules = [];

    let addRules = rule => {
      rules.push(rule);
    };
    appCompatSpec.all.forEach(addRules);
    if (appCompatSpec.hasOwnProperty(appName)) {
      appCompatSpec[appName].forEach(addRules);
    }

    return rules;
  }

  // ---------------------------------------------------------------------------
  // exported functions
  // ---------------------------------------------------------------------------

  self.setExtensionCompatibilitySpec = function(aRules) {
    extensionCompatibilitySpec = aRules;

    updateExtensionCompatibility();
    browser.management.onEnabled.addListener(updateExtensionCompatibility);
    browser.management.onDisabled.addListener(updateExtensionCompatibility);
  };

  self.setApplicationCompatibilitySpec = function(aSpec) {
    appCompatSpec = aSpec;
    updateApplicationCompatibility();
  };

  self.forEachCompatibilityRule = function(aCallback) {
    extRulesToIds.forEach((rule, addonIds) => {
      const addonNames = addonIds.
          map(id => addonIdsToNames.get(id)).
          join(", ");
      const [origin, dest] = rule;
      aCallback.call(null, {origin, dest, info: addonNames});
    });
    appCompatRules.forEach(([origin, dest]) => {
      aCallback.call(null, {origin, dest, info: appName});
    });
  };

  self.checkBaseUriWhitelist = function(aBaseUri) {
    if (!whitelistedBaseUrisToIds.has(aBaseUri)) {
      return {isWhitelisted: false};
    }
    let addonId = whitelistedBaseUrisToIds.get(aBaseUri);
    let addonName = addonIdsToNames.get(addonId);
    return {isWhitelisted: true, addonName};
  };

  self.getTopLevelDocTranslation = function(uri) {
    // We're not sure if the array will be fully populated during init. This
    // is especially a concern given the async addon manager API in Firefox 4.
    if (topLevelDocTranslationRules.has(uri)) {
      return topLevelDocTranslationRules.get(uri).translatedUri;
    }
    return null;
  };

  return self;
})();
