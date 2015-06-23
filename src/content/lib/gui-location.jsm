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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = [
  "GUILocation",
  "GUIOrigin",
  "GUIDestination",
  "GUILocationProperties"
];

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules(["lib/utils/constants"], this);


function GUILocation(value, properties) {
  this.value = value || null;
  this.properties = properties || null;
}

GUILocation.prototype.toString = function() {
  return this.value;
}

/**
 * @static
 */
GUILocation.merge = function (guiLocation, location1, location2) {
  return new guiLocation(
    location1.value,  // we assume: location1.value == location2.value
    GUILocationProperties.merge(location1.properties, location2.properties));
};

/**
 * @static
 */
GUILocation.existsInArray = function (locationString, locations) {
  return (GUILocation.indexOfLocationInArray(locationString, locations) != -1);
};

/**
 * @static
 * @param {String}
 *          locationString The location saved in GUILocation.value
 * @param {String}
 *          locations Array of GUILocation objects
 * @return {int} The index of the first GUILocation object which contains the
 *          specified locationString. If it doesn't exist, it returns -1.
 */
GUILocation.indexOfLocationInArray = function (locationString, locations) {
  if (locationString instanceof GUILocation) {
    locationString = locationString.value;
  }
  for (var i in locations) {
    if (locations[i].value == locationString) {
      return i;
    }
  }
  return -1;
};

/**
 * compare functions used to sort an Array of GUIDestination objects.
 *
 * @static
 */
GUILocation.sortByNumRequestsCompareFunction = function (a, b) {
  return GUILocation.compareFunction(a, b, "sortByNumRequests");
};
GUILocation.compareFunction = function (a, b, sortType) {
  var a_default = (a.properties.numDefaultPolicyRequests > 0);
  var b_default = (b.properties.numDefaultPolicyRequests > 0);

  if (a_default !== b_default) {
    if (a_default === true) {
      // default-policy destinations first.
      return -1;
    } else {
      return 1
    }
  }

  if (sortType == "sortByNumRequests") {
    if (a.properties.numRequests > b.properties.numRequests) {
      return -1;
    }
    if (a.properties.numRequests < b.properties.numRequests) {
      return 1;
    }
  }


  if (a.value > b.value) {
    return 1;
  }
  if (a.value < b.value) {
    return -1;
  }
  return 0;
};





/**
 * GUIOrigin objects are used to hand over not only "origin" strings, like
 * "example.com", but also properties which might be useful to display more
 * information on the GUI.
 */
function GUIOrigin(origin, properties) {
  GUILocation.call(this, origin, properties);
}
GUIOrigin.prototype = new GUILocation;

/**
 * @static
 */
GUIOrigin.merge = GUILocation.merge.bind(GUIOrigin, GUIOrigin);
GUIOrigin.indexOfOriginInArray = GUILocation.indexOfLocationInArray;





/**
 * GUIDestination objects are used to hand over not only "destination" strings,
 * like "example.com", but also properties which might be useful to display more
 * information on the GUI.
 */
function GUIDestination(dest, properties) {
  GUILocation.call(this, dest, properties);
}
GUIDestination.prototype = new GUILocation;

/**
 * @static
 */
GUIDestination.merge = GUILocation.merge.bind(GUIDestination, GUIDestination);
GUIDestination.indexOfDestInArray = GUILocation.indexOfLocationInArray;






function GUILocationProperties(value, properties) {
  this.reset();
}

GUILocationProperties.prototype.reset = function() {
  this.numRequests = 0;
  this.numDefaultPolicyRequests = 0;
  this.numAllowedRequests = 0;
  this.numBlockedRequests = 0;
};

/**
  * This function iterates through all requests of a destBase (or originBase),
  * looks for properties and returns them.
  *
  * @param {Array} requests
  *        the [originBase|destBase] multidimensional array.
  * @param {boolean} ruleAction
  *        (optional) If specified, all requests will be counted as a request
  *        with the specified rule action without being checked.
  *        Otherwise the ruleAction will be checked for every single request.
  */
GUILocationProperties.prototype.accumulate = function (requests, ruleAction) {
  var extractRuleActions = (undefined === ruleAction);
  var ruleActionCounter = 0;

  for (var destIdent in requests) {
    for (var destUri in requests[destIdent]) {
      for (var i in requests[destIdent][destUri]) {
        ++this.numRequests;

        // depending on ruleAction:
        if (!extractRuleActions) {
          ++ruleActionCounter;
        } else if (requests[destIdent][destUri][i].isAllowed) {
          ++this.numAllowedRequests;
        } else {
          ++this.numBlockedRequests;
        }

        if ( requests[destIdent][destUri][i].isDefaultPolicyUsed() ) {
          ++this.numDefaultPolicyRequests;
        }
      }
    }
  }

  switch (ruleAction) {
    case C.RULE_ACTION_ALLOW:
      this.numAllowedRequests += ruleActionCounter;
      break;

    case C.RULE_ACTION_DENY:
      this.numBlockedRequests += ruleActionCounter;
      break;

    default:
      break;
  }
};

/**
 * @static
 */
GUILocationProperties.requestCountProperties = [
  "numRequests",
  "numDefaultPolicyRequests",
  "numBlockedRequests",
  "numAllowedRequests"
];

/**
 * @static
 *
 * Merge the given GUILocationProperties object to a new object
 */
GUILocationProperties.merge = function (prop1, prop2) {
  var requestCountProperties = GUILocationProperties.requestCountProperties;
  var newObj = new GUILocationProperties();

  for (var i in requestCountProperties) {
    var propertyName = requestCountProperties[i];
    newObj[propertyName] += prop1[propertyName] + prop2[propertyName];
  }

  return newObj;
};
