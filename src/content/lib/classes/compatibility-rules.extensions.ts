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

/// <reference path="./compatibility-rules.d.ts" />

import {MapOfSets} from "content/lib/classes/map-of-sets";

type AddonIdsToNames_Map = Map<AddonID, AddonName>;
type ExtRulesToIds_MapOfSets = MapOfSets<Rule, AddonID>;
type WhitelistedBaseUrisToIds_MapOfSets = MapOfSets<BaseUri, AddonID>;
type TopLevelDocTranslationRules_Map = Map<Origin, ITopLevelDocTranslationInfo>;

// =============================================================================
// utilities
// =============================================================================

function maybeForEach(
    aObj: any,
    aPropName: string,
    aCallback: (prop: any) => void,
) {
  if (aObj.hasOwnProperty(aPropName)) {
    aObj[aPropName].forEach(aCallback);
  }
}

// =============================================================================
// ExtensionCompatibilityRules
// =============================================================================

export class ExtensionCompatibilityRules {
  private spec: any;

  private addonIdsToNames: AddonIdsToNames_Map;
  private extRulesToIds: ExtRulesToIds_MapOfSets;
  private whitelistedBaseUrisToIds: WhitelistedBaseUrisToIds_MapOfSets;
  private topLevelDocTranslationRules: TopLevelDocTranslationRules_Map;

  private listener: ManagementListener;
  private pWhenReady: Promise<void>;

  constructor(aSpec: any) {
    this.spec = aSpec;

    this.update();
    this.listener = (info: any) => {
      this.update();
    };
    browser.management.onEnabled.addListener(this.listener);
    browser.management.onDisabled.addListener(this.listener);
  }

  public get whenReady() {
    return this.pWhenReady;
  }

  public get [Symbol.iterator]() {
    const self: ExtensionCompatibilityRules = this;
    return function*() {
      // tslint:disable-next-line:prefer-const
      for (let [rule, addonIds] of self.extRulesToIds.mapEntries()) {
        const addonNames = Array.from(addonIds).
            map((id: AddonID) => self.addonIdsToNames.get(id)).
            join(", ");
        const [origin, dest] = rule;
        yield {origin, dest, info: addonNames};
      }
    };
  }

  public checkBaseUriWhitelist(aBaseUri: BaseUri) {
    const addonIds = this.whitelistedBaseUrisToIds.get(aBaseUri);
    if (addonIds === undefined) {
      return {isWhitelisted: false};
    }
    const addonNames = Array.from(addonIds).map(
        (addonId) => this.addonIdsToNames.get(addonId)).
        join(", ");
    return {isWhitelisted: true, addonNames};
  }

  public getTopLevelDocTranslation(uri: string): Dest | null {
    // We're not sure if the array will be fully populated during init. This
    // is especially a concern given the async addon manager API in Firefox 4.
    const info = this.topLevelDocTranslationRules.get(uri);
    if (info === undefined) {
      return null;
    }
    return info.translatedUri;
  }

  private update() {
    this.pWhenReady = browser.management.getAll().
        then((extensionInfos: any) => {
          Object.assign(this,
              this.extensionInfosToCompatibilityRules(extensionInfos));
          return;
        });
    this.pWhenReady.
        catch((e: any) => {
          console.error("Could not update extension compatibility. Details:");
          console.dir(e);
        });
  }

  private extensionInfosToCompatibilityRules(aExtensionInfos: any): {
    addonIdsToNames: AddonIdsToNames_Map,
    extRulesToIds: ExtRulesToIds_MapOfSets,
    whitelistedBaseUrisToIds: WhitelistedBaseUrisToIds_MapOfSets,
    topLevelDocTranslationRules: TopLevelDocTranslationRules_Map,
  } {
    const addonIdsToNames: AddonIdsToNames_Map = new Map();
    const extRulesToIds: ExtRulesToIds_MapOfSets = new MapOfSets();
    const whitelistedBaseUrisToIds: WhitelistedBaseUrisToIds_MapOfSets =
        new MapOfSets();
    const topLevelDocTranslationRules: TopLevelDocTranslationRules_Map =
        new Map();

    const enabledAddons = aExtensionInfos.filter((addon: any) => addon.enabled);
    const idsToExtInfos = new Map();

    // tslint:disable-next-line:prefer-const (see bug 1101653, fixed in Fx51)
    for (let addon of enabledAddons) {
      idsToExtInfos.set(addon.id, addon);
      addonIdsToNames.set(addon.id, addon.name);
    }

    this.spec.forEach((spec: any) => {
      const enabledAddonIds = spec.ids.
          filter((id: string) => idsToExtInfos.has(id));
      if (enabledAddonIds.length === 0) {
        return;
      }
      maybeForEach(spec, "rules", (rule: Rule) => {
        // tslint:disable-next-line:prefer-const
        for (let id of enabledAddonIds) {
          extRulesToIds.addToSet(rule, id);
        }
      });
      maybeForEach(spec, "whitelistedBaseURIs", (baseUri: string) => {
        // tslint:disable-next-line:prefer-const
        for (let id of enabledAddonIds) {
          whitelistedBaseUrisToIds.addToSet(baseUri, id);
        }
      });

      const processRawTopLevelDocTranslationRule = (
          rules: RawTopLevelDocTranslationRule[],
      ) => {
        rules.forEach((rule) => {
          const [uriToBeTranslated, translatedUri] = rule;
          if (topLevelDocTranslationRules.has(uriToBeTranslated)) {
            console.error("Multiple definitions of traslation rule " +
                `"${uriToBeTranslated}".`);
          }
          topLevelDocTranslationRules.set(uriToBeTranslated, {
            extensionIds: enabledAddonIds,
            translatedUri,
          });
        });
      };
      maybeForEach(spec, "topLevelDocTranslationRules",
          processRawTopLevelDocTranslationRule);
    });

    return {
      addonIdsToNames,
      extRulesToIds,
      topLevelDocTranslationRules,
      whitelistedBaseUrisToIds,
    };
  }
}
