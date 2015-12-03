/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

/* global Components */
const {interfaces: Ci, results: Cr, utils: Cu} = Components;

/* exported OldRules */
this.EXPORTED_SYMBOLS = ["OldRules"];

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {DomainUtil} = importModule("lib/utils/domains");
let {rpPrefBranch} = importModule("lib/prefs");

//==============================================================================
// OldRules
//==============================================================================

var OldRules = (function() {
  "use strict";

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
  OldRules.prototype.getAsNewRules = function(addHostWildcard) {
    var rules = [];
    var {origins, dests, originsToDests} = this.prefStringSets;

    for (let origin of origins) {
      rules.push({
        o: OldRules.getEndpointSpecFromString(origin, addHostWildcard)
      });
    }

    for (let dest of dests) {
      rules.push({
        d: OldRules.getEndpointSpecFromString(dest, addHostWildcard)
      });
    }

    for (let originToDest of originsToDests) {
      let [origin, dest] = originToDest.split("|");

      rules.push({
        o: OldRules.getEndpointSpecFromString(origin, addHostWildcard),
        d: OldRules.getEndpointSpecFromString(dest, addHostWildcard)
      });
    }

    return rules;
  };

  /**
   * @static
   * @param {string} aEndpointString
   * @param {boolean} aAddHostWildcard
   * @return {Object} The endpoints' specifications.
   */
  OldRules.getEndpointSpecFromString = function(aEndpointString,
                                                 aAddHostWildcard) {
    var spec = {};
    if (DomainUtil.isValidUri(aEndpointString)) {
      let uriObj = DomainUtil.getUriObject(aEndpointString);
      spec.h = uriObj.host;
      spec.s = uriObj.scheme;
      if (uriObj.port !== -1) {
        spec.port = uriObj.port;
      }
    } else {
      spec.h = aEndpointString.split("/")[0];
    }
    // FIXME: Issue #731;  Detect if the host is a Base Domain.
    if (spec.h && aAddHostWildcard && OldRules._isHostname(spec.h)) {
      spec.h = "*." + spec.h;
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
      return rpPrefBranch.getComplexValue(aPrefName, Ci.nsISupportsString).data;
    } catch (e) {
      if (false === e.hasOwnProperty("result") ||
          e.result !== Cr.NS_ERROR_UNEXPECTED) {
        Cu.reportError(e);
      }
      return "";
    }
  };

  return OldRules;
}());
