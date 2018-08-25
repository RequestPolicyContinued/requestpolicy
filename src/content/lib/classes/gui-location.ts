/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import {C} from "data/constants";
import { RequestResult } from "lib/classes/request-result";

interface IGuiLocation<T extends GUILocation> {
  // value: any;
  // properties: any;
  new (value: any, properties: any): T;
}

// =============================================================================
// GUILocation
// =============================================================================

export class GUILocation {
  public static merge_<T extends GUILocation>(
      SubclassOfGUILocation: IGuiLocation<T>,
      location1: T,
      location2: T,
  ) {
    return new SubclassOfGUILocation(
        location1.value, // we assume: location1.value == location2.value
        GUILocationProperties.merge(location1.properties, location2.properties),
    );
  }

  public static existsInArray(
      locationString: string | GUILocation,
      locations: GUILocation[],
  ): boolean {
    return GUILocation.indexOfLocationInArray(locationString, locations) !== -1;
  }

  /**
   * Get the index of the first GUILocation object which contains the
   * specified locationString. If it doesn't exist, it returns -1.
   */
  public static indexOfLocationInArray(
      aLocation: string | GUILocation,
      locations: GUILocation[],
  ): number {
    const locationString: string =
        aLocation instanceof GUILocation ? aLocation.value :
          aLocation;
    for (const [i, location] of locations.entries()) {
      if (location.value === locationString) {
        return i;
      }
    }
    return -1;
  }

  /**
   * compare functions used to sort an Array of GUIDestination objects.
   */
  public static sortByNumRequestsCompareFunction(
      a: GUILocation,
      b: GUILocation,
  ): number {
    return GUILocation.compareFunction(a, b, "sortByNumRequests");
  }

  public static compareFunction(
      a: GUILocation,
      b: GUILocation,
      sortType: "sortByNumRequests" | "sortByDestName",
  ) {
    const aDefault = 0 < a.properties.numDefaultPolicyRequests;
    const bDefault = 0 < b.properties.numDefaultPolicyRequests;

    if (aDefault !== bDefault) {
      if (aDefault === true) {
        // default-policy destinations first.
        return -1;
      } else {
        return 1;
      }
    }

    if (sortType === "sortByNumRequests") {
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
  }

  constructor(public value: any = null, public properties: any = null) {
  }

  public toString() {
    return this.value;
  }
}

// =============================================================================
// GUIOrigin
// =============================================================================

/**
 * GUIOrigin objects are used to hand over not only "origin" strings, like
 * "example.com", but also properties which might be useful to display more
 * information on the GUI.
 */
// tslint:disable-next-line:max-classes-per-file
export class GUIOrigin extends GUILocation {
  public static merge(
      location1: GUIOrigin,
      location2: GUIOrigin,
  ) {
    return GUILocation.merge_<GUIOrigin>(
        GUIOrigin,
        location1,
        location2,
    );
  }

  public static indexOfOriginInArray(
      aLocation: string | GUIOrigin,
      locations: GUIOrigin[],
  ) {
    return GUILocation.indexOfLocationInArray(aLocation, locations);
  }

  constructor(origin: string, properties: GUILocationProperties) {
    super(origin, properties);
  }
}

// =============================================================================
// GUIDestination
// =============================================================================

/**
 * GUIDestination objects are used to hand over not only "destination" strings,
 * like "example.com", but also properties which might be useful to display more
 * information on the GUI.
 */
// tslint:disable-next-line:max-classes-per-file
export class GUIDestination extends GUILocation {
  public static merge(
      location1: GUIDestination,
      location2: GUIDestination,
  ) {
    return GUILocation.merge_<GUIDestination>(
        GUIDestination,
        location1,
        location2,
    );
  }
  public static indexOfDestInArray(
      aLocation: string | GUIDestination,
      locations: GUIDestination[],
  ) {
    return GUILocation.indexOfLocationInArray(aLocation, locations);
  }

  constructor(dest: string, properties: GUILocationProperties) {
    super(dest, properties);
  }
}

// =============================================================================
// GUILocationProperties
// =============================================================================

// tslint:disable-next-line:max-classes-per-file
export class GUILocationProperties {
  public static requestCountProperties = [
    "numRequests",
    "numDefaultPolicyRequests",
    "numBlockedRequests",
    "numAllowedRequests",
  ];

  /**
   * Merge the given GUILocationProperties object to a new object
   */
  public static merge(
      prop1: GUILocationProperties,
      prop2: GUILocationProperties,
  ): GUILocationProperties {
    const requestCountProperties = GUILocationProperties.requestCountProperties;
    const newObj = new GUILocationProperties();

    for (const propertyName of requestCountProperties) {
      (newObj as any)[propertyName] +=
          (prop1 as any)[propertyName] + (prop2 as any)[propertyName];
    }

    return newObj;
  }

  public numRequests: number;
  public numDefaultPolicyRequests: number;
  public numAllowedRequests: number;
  public numBlockedRequests: number;

  constructor() {
    this.reset();
  }

  public reset() {
    this.numRequests = 0;
    this.numDefaultPolicyRequests = 0;
    this.numAllowedRequests = 0;
    this.numBlockedRequests = 0;
  }

  /**
   * Iterate through all requests of a destBase (or originBase),
   * look for properties.
   */
  public accumulate(
      requests: {
        [destIdent: string]: {
          [destUri: string]: RequestResult[];
        };
      },
      // If `ruleAction` is specified, all requests will be counted as
      // a request with the specified rule action without being checked.
      // Otherwise the ruleAction will be checked for every single request.
      ruleAction?: number,
  ) {
    const extractRuleActions = undefined === ruleAction;
    let ruleActionCounter = 0;

    // tslint:disable-next-line:forin
    for (const destIdent in requests) {
      const destIdentRequests = requests[destIdent];
      // tslint:disable-next-line:forin
      for (const destUri in destIdentRequests) {
        const destUriRequests = destIdentRequests[destUri];
        // tslint:disable-next-line:forin
        for (const i in destUriRequests) {
          const request = destUriRequests[i];
          ++this.numRequests;

          // depending on ruleAction:
          if (!extractRuleActions) {
            ++ruleActionCounter;
          } else if (request.isAllowed) {
            ++this.numAllowedRequests;
          } else {
            ++this.numBlockedRequests;
          }

          if (request.isDefaultPolicyUsed()) {
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
  }
}
