/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

/// <reference path="./xul-utils.d.ts" />

import { API, JSMs, XUL } from "bootstrap/api/interfaces";
import { C } from "data/constants";
import { arrayIncludes } from "lib/utils/js-utils";

declare const LegacyApi: API.ILegacyApi;
declare const Services: JSMs.Services;

// =============================================================================
// XULUtils
// =============================================================================

export let xulTrees: IXulTreeLists;

/**
 * IIFE: Import the XUL trees and ensure their integrity.
 */
(function importXulTrees() {
  const maybeIncompleteXulTrees: IMaybeIncompleteXulTreeLists = {};

  const xulTreesScope = {
    C,
    appID: Services.appinfo.ID,
    exports: maybeIncompleteXulTrees,
  };

  Services.scriptloader.loadSubScript(
      "chrome://rpcontinued/content/ui/xul-trees.js",
      xulTreesScope,
  );

  // For ensuring that each Element Spec has an ID.
  let nextID = 1;

  // Call the "ensureIntegrity" function on _all_ element specs
  // of _all_ trees.
  // tslint:disable-next-line:forin
  for (const treeName in maybeIncompleteXulTrees) {
    recursivelyGetAllElementSpecs(maybeIncompleteXulTrees[treeName]).
        forEach(ensureIntegrity);
  }

  xulTrees = maybeIncompleteXulTrees as IXulTreeLists;

  function ensureIntegrity(
      aElementSpec: MaybeIncompleteRootOrNonrootXulElementSpec,
  ) {
    // Ensure "attributes" exists.
    if (!("attributes" in aElementSpec)) {
      aElementSpec.attributes = {};
    }

    // Ensure the Element Spec has an ID attribute.
    if (!("id" in aElementSpec.attributes!)) {
      aElementSpec.attributes!.id = `rpc-autoid-${nextID++}`;
    }
  }
})();

function recursivelyGetAllElementSpecs<
    T = IXulElementSpec
>(aElementSpecList: T[]): T[];
function recursivelyGetAllElementSpecs<
    T = IMaybeIncompleteXulElementSpec
>(aElementSpecList: T[]): T[];
function recursivelyGetAllElementSpecs<
    T extends (
        IXulElementSpec |
        IMaybeIncompleteXulElementSpec
    )
>(aElementSpecList: T[]): T[] {
  let allElementSpecs: T[] = [];

  for (const elementSpec of aElementSpecList) {
    if (!elementSpec) {
      console.error("An element spec is null!");
      continue;
    }

    // Add this element spec.
    allElementSpecs.push(elementSpec);

    // Add all children recursively.
    if ("children" in elementSpec) {
      const allChildrenSpecs = recursivelyGetAllElementSpecs<T>(
          (elementSpec.children! as T[]),
      );
      allElementSpecs = allElementSpecs.concat(allChildrenSpecs);
    }
  }

  return allElementSpecs;
}

function getParentElementOfSubobject(
    aDocument: XUL.chromeDocument,
    aParent: ISubobjectParentSpec,
): Element | null {
  const subobjectTree = aParent.tree;
  let parentElement = aDocument.getElementById(aParent.id);
  if (!parentElement === null) return null;
  for (let i = 0, len = subobjectTree.length; i < len; ++i) {
    parentElement = (parentElement as any)[subobjectTree[i]];
  }
  return parentElement;
}

function isRootXulElementSpec(
    aElementSpec: RootOrNonrootXulElementSpec,
): aElementSpec is IXulTree {
  return "parent" in aElementSpec;
}

function getParentElement(
    aDocument: XUL.chromeDocument,
    aElementSpec: RootOrNonrootXulElementSpec,
): Element | null | false {
  if (!isRootXulElementSpec(aElementSpec)) return false;
  if ("id" in aElementSpec.parent) {
    return aDocument.getElementById(aElementSpec.parent.id);
  } else if (aElementSpec.parent.special) {
    switch (aElementSpec.parent.special.type) {
      case "__window__":
        return aDocument.querySelector("window");

      case "subobject":
        return getParentElementOfSubobject(
            aDocument,
            aElementSpec.parent.special,
        );

      default:
        return false;
    }
  } else {
    return false;
  }
}

/**
 * Get the localized value of an attribute.
 */
function getLocalizedValue(aRawValue: string): string {
  if (!LegacyApi.i18n.matchKeyPattern(aRawValue)) {
    return aRawValue;
  }
  return LegacyApi.i18n.updateString(aRawValue);
}

function setAttributes(aElement: Element, aElementSpec: IXulElementSpec) {
  if (!("attributes" in aElementSpec)) return;
  // tslint:disable-next-line:forin
  for (const attributeName in aElementSpec.attributes) {
    const value = getLocalizedValue(aElementSpec.attributes[attributeName]);
    if (value) {
      aElement.setAttribute(attributeName, value);
    }
  }
}

const {addEventListeners, removeEventListeners} = (() => {
  function getEventListener(
      aRootObject: any,
      aListenerSpec: string[],
  ): Function | null {
    let object = aRootObject;
    for (const propertyName of aListenerSpec) {
      if (!object.hasOwnProperty(propertyName)) {
        return null;
      }
      object = object[propertyName];
    }
    return object;
  }

  function getEventInfoList(aEventTarget: Element, aEventList: any): any[] {
    if (!aEventList) {
      return [];
    }
    const rootObject = (
      aEventTarget.ownerDocument.defaultView as any
    ).rpcontinued;

    return Object.keys(aEventList).map((eventName) => {
      return [
        eventName,
        getEventListener(rootObject, aEventList[eventName]),
      ];
    });
  }

  function addEventListeners_(
      aEventTarget: Element,
      {events}: IXulElementSpec,
  ) {
    const listeners = getEventInfoList(aEventTarget, events);
    listeners.forEach(([eventName, listener]) => {
      aEventTarget.addEventListener(eventName, listener, false);
    });
  }

  function removeEventListeners_(
      aEventTarget: Element,
      {events}: IXulElementSpec,
  ) {
    const listeners = getEventInfoList(aEventTarget, events);
    listeners.forEach(([eventName, listener]) => {
      aEventTarget.removeEventListener(eventName, listener, false);
    });
  }

  return {
    addEventListeners: addEventListeners_,
    removeEventListeners: removeEventListeners_,
  };
})();

function recursivelyAddXULElements(
    aDocument: XUL.chromeDocument,
    aElementSpecList: IXulElementSpec[],
    aParentElement: Element | null = null,
) {
  for (const elementSpec of aElementSpecList) {
    if (!elementSpec || !elementSpec.tag) {
      console.error("Element spec incomplete!");
      continue;
    }
    const parentElement = aParentElement ? aParentElement :
        getParentElement(aDocument, elementSpec);
    if (false === parentElement) {
      console.error(
          `The parent element could not be determined. ` +
          `Tag: ${elementSpec.tag}; ` +
          `ID: ${elementSpec.attributes.id}`,
      );
      continue;
    }
    if (parentElement === null) {
      console.error(`parentElement of '${elementSpec.attributes.id}' is null!`);
      continue;
    }

    // Create the new element.
    const newElement = aDocument.createElement(elementSpec.tag);

    // Set all attributes.
    setAttributes(newElement, elementSpec);

    // Add all event listeners.
    addEventListeners(newElement, elementSpec);

    // Recurse.
    if (elementSpec.children) {
      recursivelyAddXULElements(aDocument, elementSpec.children, newElement);
    }
    parentElement.appendChild(newElement);
  }
}

export function addTreeElementsToWindow(
    aWin: XUL.chromeWindow,
    aTreeName: string,
) {
  if (xulTrees.hasOwnProperty(aTreeName)) {
    recursivelyAddXULElements(aWin.document, xulTrees[aTreeName]);
  }
}

/**
 * Return a list of the IDs of the specified tree's root elements.
 */
function getRootElementIDs(aTreeName: string): string[] {
  const ids = xulTrees[aTreeName].map((aElementSpec) => {
    return aElementSpec.attributes.id;
  });
  return ids;
}

export function removeTreeElementsFromWindow(
    aWin: XUL.chromeWindow,
    aTreeName: string,
) {
  if (!xulTrees.hasOwnProperty(aTreeName)) {
    console.error(`There's no tree with name '${aTreeName}'.`);
    return;
  }

  const $id = aWin.document.getElementById.bind(aWin.document);

  // Recursively remove all event listeners.
  const elementSpecs = recursivelyGetAllElementSpecs(xulTrees[aTreeName]);
  for (const elementSpec of elementSpecs) {
    const {id} = elementSpec.attributes;
    const eventTarget = $id(id);
    if (!eventTarget) {
      console.error(`Could not find element with ID "${id}".`);
      continue;
    }
    removeEventListeners(eventTarget, elementSpec);
  }

  // Remove the root elements.
  for (const id of getRootElementIDs(aTreeName)) {
    const node = $id(id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
}

export const keyboardShortcuts = (() => {
  const self: any = {};

  // tslint:disable-next-line:max-line-length
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Attribute/modifiers
  // See also the SDK Hotkeys API
  // https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/hotkeys
  const VALID_MODIFIERS = [
    "shift",
    "alt",
    "meta",
    "control",
    "accel",
  ];

  function error(msg: string) {
    return {success: false, errorMessage: msg};
  }

  function success<T extends {success?: boolean}>(returnValue: T) {
    returnValue.success = true;
    return returnValue as T & {success: true};
  }

  function isValidModifier(aModifier: string) {
    return arrayIncludes(VALID_MODIFIERS, aModifier);
  }

  const keyRegEx = /^[a-z]$/;

  function _getKeyAttributesFromCombo(aCombo: string) {
    if (typeof aCombo !== "string") {
      return error("Not a string!");
    }
    if (aCombo === "") {
      return error("The string must not be empty.");
    }

    const parts = aCombo.split(" ");
    // Take the last element as the key
    const key = parts.slice(-1)[0];
    // Take all elements except the last one as the modifiers.
    let modifiers = parts.slice(0, -1);
    // Remove duplicates
    modifiers = [...new Set(modifiers)];

    for (const modifier of modifiers) {
      if (false === isValidModifier(modifier)) {
        return error(`Invalid modifier: "${modifier}"`);
      }
    }

    if (!keyRegEx.test(key)) {
      return error(`Invalid key: "${key}"`);
    }

    return success({
      key,
      modifiers: modifiers.join(" "),
      success: undefined,
    });
  }

  /**
   * Check if the <key modifiers="..."> string is valid.
   */
  self.getKeyAttributesFromCombo = (aCombo: string) => {
    return _getKeyAttributesFromCombo(aCombo);
  };

  return self;
})();
