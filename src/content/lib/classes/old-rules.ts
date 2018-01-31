/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
 * Copyright (c) 2015 Martin Kimmerle
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

import * as DomainUtil from "content/lib/utils/domain-utils";
import {
  getComplexValueFromPrefBranch,
} from "content/lib/utils/try-catch-utils";

declare const Cc: any;
declare const Ci: any;
declare const LegacyApi: any;
declare const Services: any;

interface IPrefStrings {
  dests: string;
  origins: string;
  originsToDests: string;
}

interface IPrefStringSets {
  dests: Set<IPrefStrings["dests"]>;
  origins: Set<IPrefStrings["origins"]>;
  originsToDests: Set<IPrefStrings["originsToDests"]>;
}

let IDNService: any = null;

// =============================================================================
// OldRules
// =============================================================================

export class OldRules {
  /**
   * @static
   * @param  {string|nsIURI} aEndpoint
   * @return {boolean}
   */
  public static shouldWildcardBeAddedToEndpoint(aEndpoint: any) {
    if (!IDNService) {
      IDNService = Cc["@mozilla.org/network/idn-service;1"].
          getService(Ci.nsIIDNService);
    }
    let host: string | null;
    let getBaseDomain;
    if (aEndpoint instanceof Ci.nsIURI) {
      const uri = aEndpoint;
      host = DomainUtil.getHostByUriObj(uri);
      getBaseDomain = () => Services.eTLD.getBaseDomain(uri, 0);
    } else {
      host = aEndpoint;
      getBaseDomain = () => Services.eTLD.getBaseDomainFromHost(host, 0);
    }

    try {
      let baseDomain = getBaseDomain();
      baseDomain = IDNService.convertToDisplayIDN(baseDomain, {});
      return host === baseDomain;
    } catch (e) {
      if (e.name === "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS") {
        return false;
      } else if (e.name === "NS_ERROR_HOST_IS_IP_ADDRESS") {
        return false;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw e;
      }
    }
  }

  /**
   * @static
   * @param {string} aEndpointString
   * @return {Object} The endpoints' specifications.
   */
  public static getEndpointSpecFromString(aEndpointString: string) {
    const spec: any = {};
    if (DomainUtil.isValidUri(aEndpointString)) {
      const uriObj = DomainUtil.getUriObject(aEndpointString);
      spec.s = uriObj.scheme;
      const host = DomainUtil.getHostByUriObj(uriObj);
      if (host !== null) {
        spec.h = host;
        if (OldRules.shouldWildcardBeAddedToEndpoint(uriObj)) {
          spec.h = "*." + spec.h;
        }
        if (uriObj.port !== -1) {
          spec.port = uriObj.port;
        }
      }
    } else {
      spec.h = aEndpointString.split("/")[0];
      if (OldRules.shouldWildcardBeAddedToEndpoint(spec.h)) {
        spec.h = "*." + spec.h;
      }
    }
    return spec;
  }

  /**
   * @param {string} aPrefName
   * @return {string} The value of the pref, or an empty string if
   *     the pref does not exist.
   */
  private static getPrefString(aPrefName: string): string {
    const result = getComplexValueFromPrefBranch(
        LegacyApi.prefs.branches.rp.branch, aPrefName, Ci.nsISupportsString);
    if (!result.error) return result.value!;
    const e = result.error;
    if (e.name !== "NS_ERROR_UNEXPECTED") {
      console.dir(e);
    }
    return "";
  }

  private customPrefStrings: IPrefStrings | null = null;
  private lazyPrefStrings: IPrefStrings;
  private lazyPrefStringSets: IPrefStringSets;

  constructor(
      aOrigins = "",
      aDestinations = "",
      aOriginsToDestinations = "",
  ) {
    if (aOrigins || aDestinations || aOriginsToDestinations) {
      this.customPrefStrings = {
        dests: String(aDestinations),
        origins: String(aOrigins),
        originsToDests: String(aOriginsToDestinations),
      };
    }
  }

  /**
   * The three strings containing the old rules.
   */
  public get prefStrings() {
    if (!this.lazyPrefStrings) {
      this.lazyPrefStrings = this.customPrefStrings || {
        dests: OldRules.getPrefString("allowedDestinations"),
        origins: OldRules.getPrefString("allowedOrigins"),
        originsToDests: OldRules.getPrefString(
            "allowedOriginsToDestinations"),
      };
    }
    return this.lazyPrefStrings;
  }

  /**
   * Three `Set`s containing the rules as strings.
   */
  public get prefStringSets() {
    function splitString(aRulesString: string): Set<string> {
      const rules = new Set(aRulesString.split(" "));

      // The string might contain double spaces.
      rules.delete("");

      return rules;
    }

    if (!this.lazyPrefStringSets) {
      const {origins, dests, originsToDests} = this.prefStrings;
      this.lazyPrefStringSets = {
        dests: splitString(dests),
        origins: splitString(origins),
        originsToDests: splitString(originsToDests),
      };
    }
    return this.lazyPrefStringSets;
  }

  /**
   * Convert the pref strings to rule objects.
   *
   * @return {Array<Object>}
   */
  public getAsNewRules() {
    const rules = [];
    const {origins, dests, originsToDests} = this.prefStringSets;

    // tslint:disable-next-line prefer-const
    for (let origin of origins) {
      rules.push({
        o: OldRules.getEndpointSpecFromString(origin),
      });
    }

    // tslint:disable-next-line prefer-const
    for (let dest of dests) {
      rules.push({
        d: OldRules.getEndpointSpecFromString(dest),
      });
    }

    // tslint:disable-next-line prefer-const
    for (let originToDest of originsToDests) {
      const parts = originToDest.split("|");

      if (parts.length === 2) {
        const [origin, dest] = parts;
        if (origin !== "" && dest !== "") {
          rules.push({
            d: OldRules.getEndpointSpecFromString(dest),
            o: OldRules.getEndpointSpecFromString(origin),
          });
          continue;
        }
      }

      // eslint-disable-next-line no-throw-literal
      throw new OldRulesParseError("Invalid old rule: \"" + originToDest +
          "\"");
    }

    return rules;
  }
}

// =============================================================================
// OldRulesParseError
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class OldRulesParseError extends Error {
  public name = "OldRulesParseError";
}
