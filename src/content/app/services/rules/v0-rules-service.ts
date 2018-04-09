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

import { UriService } from "app/services/uri-service";
import { Module } from "lib/classes/module";
import { IRuleSpec } from "lib/ruleset";
import { Log } from "models/log";

declare const Cc: any;
declare const Ci: any;
declare const Services: any;

interface IPrefStrings {
  dests: string;
  origins: string;
  originsToDests: string;
}

let IDNService: any = null;

function splitString(aRulesString: string): Set<string> {
  const rules = new Set(aRulesString.split(" "));

  // The string might contain double spaces.
  rules.delete("");

  return rules;
}

// =============================================================================
// V0RulesService
// =============================================================================

export class V0RulesService extends Module {
  private eTLDService = Services.eTLD;

  constructor(
      log: Log,
      private uriService: UriService,
  ) {
    super("app.services.rules.v0", log);
  }

  /**
   * Convert the pref strings to rule objects.
   */
  public parse(aPrefStrings: IPrefStrings): IRuleSpec[] {
    const dests = splitString(aPrefStrings.dests);
    const origins = splitString(aPrefStrings.origins);
    const originsToDests = splitString(aPrefStrings.originsToDests);

    const rules = [];

    // tslint:disable-next-line prefer-const
    for (let origin of origins) {
      rules.push({
        o: this.getEndpointSpecFromString(origin),
      });
    }

    // tslint:disable-next-line prefer-const
    for (let dest of dests) {
      rules.push({
        d: this.getEndpointSpecFromString(dest),
      });
    }

    // tslint:disable-next-line prefer-const
    for (let originToDest of originsToDests) {
      const parts = originToDest.split("|");

      if (parts.length === 2) {
        const [origin, dest] = parts;
        if (origin !== "" && dest !== "") {
          rules.push({
            d: this.getEndpointSpecFromString(dest),
            o: this.getEndpointSpecFromString(origin),
          });
          continue;
        }
      }

      // eslint-disable-next-line no-throw-literal
      throw new V0RulesParseError("Invalid old rule: \"" + originToDest +
          "\"");
    }

    return rules;
  }

  /**
   * @param  {string|nsIURI} aEndpoint
   * @return {boolean}
   */
  private shouldWildcardBeAddedToEndpoint(aEndpoint: any) {
    if (!IDNService) {
      IDNService = Cc["@mozilla.org/network/idn-service;1"].
          getService(Ci.nsIIDNService);
    }
    let host: string | null;
    let getBaseDomain;
    if (aEndpoint instanceof Ci.nsIURI) {
      const uri = aEndpoint;
      host = this.uriService.getHostByUriObj(uri);
      getBaseDomain = () => this.eTLDService.getBaseDomain(uri, 0);
    } else {
      host = aEndpoint;
      getBaseDomain = () => this.eTLDService.getBaseDomainFromHost(host, 0);
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
   * @param {string} aEndpointString
   * @return {Object} The endpoints' specifications.
   */
  private getEndpointSpecFromString(aEndpointString: string) {
    const spec: any = {};
    if (this.uriService.isValidUri(aEndpointString)) {
      const uriObj = this.uriService.getUriObject(aEndpointString);
      spec.s = uriObj.scheme;
      const host = this.uriService.getHostByUriObj(uriObj);
      if (host !== null) {
        spec.h = host;
        if (this.shouldWildcardBeAddedToEndpoint(uriObj)) {
          spec.h = `*.${spec.h}`;
        }
        if (uriObj.port !== -1) {
          spec.port = uriObj.port;
        }
      }
    } else {
      spec.h = aEndpointString.split("/")[0];
      if (this.shouldWildcardBeAddedToEndpoint(spec.h)) {
        spec.h = `*.${spec.h}`;
      }
    }
    return spec;
  }
}

// =============================================================================
// V0RulesParseError
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class V0RulesParseError extends Error {
  public name = "V0RulesParseError";
}
