/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2016 Martin Kimmerle
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

/* exported RuleUtils */
this.EXPORTED_SYMBOLS = ["RuleUtils"];

//==============================================================================
// RuleUtils
//==============================================================================

var RuleUtils = (function() {
  let self = {};

  /**
   * Get a string representation of an endpoint (origin or dest) specification.
   *
   * Example cases can be found in the unit test corresponding
   * to this function.
   */
  self.endpointSpecToDisplayString = function(aEndpointSpec) {
    if (aEndpointSpec.port !== undefined &&
        (aEndpointSpec.h === null || aEndpointSpec.h === "")) {
      return "[invalid endpoint specification]";
    }
    let scheme = aEndpointSpec.s ? String(aEndpointSpec.s) : "*";
    if (aEndpointSpec.port === undefined) {
      // Special cases.
      switch (aEndpointSpec.h) {
        case undefined:
          if (aEndpointSpec.s === undefined) {
            return "";
          }
          return scheme + ":<path> (host optional)";

        case null:
          return scheme + ":<path> (no host)";

        case "":
          return scheme + "://<path> (empty host)";

        default:
          break;
      }
    }
    var str = "";
    if (scheme !== "*" || aEndpointSpec.port) {
      str += scheme + "://";
    }
    str += aEndpointSpec.h || "*";
    if (aEndpointSpec.port) {
      str += ":" + aEndpointSpec.port;
    }
    // TODO: path
    return str;
  };

  return self;
}());
