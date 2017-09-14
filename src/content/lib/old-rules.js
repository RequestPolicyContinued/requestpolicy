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

import {DomainUtil} from "lib/utils/domains";

//==============================================================================
// OldRules
//==============================================================================

export var OldRules = (function() {
  function OldRules(aOrigins = "", aDestinations = "",
                    aOriginsToDestinations = "") {
    this._customPrefStrings = null;
    if (aOrigins || aDestinations || aOriginsToDestinations) {
      this._customPrefStrings = {
        origins: String(aOrigins),
        dests: String(aDestinations),
        originsToDests: String(aOriginsToDestinations)
      };
    }
  }

  /**
   * The three strings containing the old rules.
   */
  Object.defineProperty(OldRules.prototype, "prefStrings", {
    get: function() {
      if (!this._prefStrings) {
        this._prefStrings = this._customPrefStrings || {
          origins: OldRules._getPrefString("allowedOrigins"),
          dests: OldRules._getPrefString("allowedDestinations"),
          originsToDests: OldRules._getPrefString(
              "allowedOriginsToDestinations")
        };
      }
      return this._prefStrings;
    }
  });

  /**
   * Three `Set`s containing the rules as strings.
   */
  Object.defineProperty(OldRules.prototype, "prefStringSets", {
    get: function() {
      function splitString(aRulesString) {
        var rules = new Set(aRulesString.split(" "));

        // The string might contain double spaces.
        rules.delete("");

        return rules;
      }

      if (!this._prefStringSets) {
        let {origins, dests, originsToDests} = this.prefStrings;
        this._prefStringSets = {
          origins: splitString(origins),
          dests: splitString(dests),
          originsToDests: splitString(originsToDests)
        };
      }
      return this._prefStringSets;
    }
  });

  /**
   * Convert the pref strings to rule objects.
   */
  OldRules.prototype.getAsNewRules = function() {
    var rules = [];
    var {origins, dests, originsToDests} = this.prefStringSets;

    for (let origin of origins) {
      rules.push({
        o: OldRules.getEndpointSpecFromString(origin)
      });
    }

    for (let dest of dests) {
      rules.push({
        d: OldRules.getEndpointSpecFromString(dest)
      });
    }

    for (let originToDest of originsToDests) {
      let parts = originToDest.split("|");

      if (parts.length === 2) {
        let [origin, dest] = parts;
        if (origin !== "" && dest !== "") {
          rules.push({
            o: OldRules.getEndpointSpecFromString(origin),
            d: OldRules.getEndpointSpecFromString(dest)
          });
          continue;
        }
      }

      throw new OldRulesParseError("Invalid old rule: \"" + originToDest +
          "\"");
    }

    return rules;
  };

  /**
   * @static
   * @param  {string|nsIURI} aEndpoint
   * @return {boolean}
   */
  OldRules.shouldWildcardBeAddedToEndpoint = function(aEndpoint) {
    if (!OldRules._IDNService) {
      OldRules._IDNService = Cc["@mozilla.org/network/idn-service;1"].
          getService(Ci.nsIIDNService);
    }
    let host;
    let getBaseDomain;
    if (aEndpoint instanceof Ci.nsIURI) {
      let uri = aEndpoint;
      host = uri.host;
      getBaseDomain = () => Services.eTLD.getBaseDomain(uri, 0);
    } else {
      host = aEndpoint;
      getBaseDomain = () => Services.eTLD.getBaseDomainFromHost(host, 0);
    }

    try {
      let baseDomain = getBaseDomain();
      baseDomain = OldRules._IDNService.convertToDisplayIDN(baseDomain, {});
      return host === baseDomain;
    } catch (e) {
      if (e.name === "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS") {
        return false;
      } else if (e.name === "NS_ERROR_HOST_IS_IP_ADDRESS") {
        return false;
      } else {
        throw e;
      }
    }
  };

  /**
   * @static
   * @param {string} aEndpointString
   * @return {Object} The endpoints' specifications.
   */
  OldRules.getEndpointSpecFromString = function(aEndpointString) {
    var spec = {};
    if (DomainUtil.isValidUri(aEndpointString)) {
      let uriObj = DomainUtil.getUriObject(aEndpointString);
      spec.s = uriObj.scheme;
      if (DomainUtil.uriObjHasHost(uriObj)) {
        spec.h = uriObj.host;
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
  };

  // FIXME: This should be a function of DomainUtil.
  OldRules._isHostname = function(host) {
    return !DomainUtil.isValidUri(host) && !DomainUtil.isIPAddress(host);
  };

  /**
   * @param {string} aPrefName
   * @return {string} The value of the pref, or an empty string if
   *     the pref does not exist.
   */
  OldRules._getPrefString = function(aPrefName) {
    try {
      return LegacyApi.prefs.branches.rp.branch.
          getComplexValue(aPrefName, Ci.nsISupportsString).data;
    } catch (e) {
      if (e.name !== "NS_ERROR_UNEXPECTED") {
        console.dir(e);
      }
      return "";
    }
  };

  return OldRules;
}());

//==============================================================================
// OldRulesParseError
//==============================================================================

export function OldRulesParseError() {
  Error.apply(this, arguments);
  this.name = "OldRulesParseError";
}

OldRulesParseError.prototype = Object.create(Error.prototype);
OldRulesParseError.prototype.constructor = Error;
