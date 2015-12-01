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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

/* global Components */
const {utils: Cu} = Components;

/* exported XULUtils */
this.EXPORTED_SYMBOLS = ["XULUtils"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Logger} = importModule("lib/logger");
let {StringUtils} = importModule("lib/utils/strings");
let {C} = importModule("lib/utils/constants");

//==============================================================================
// XULUtils
//==============================================================================

var XULUtils = {};

var xulTrees = XULUtils.xulTrees = {};


/**
 * IIFE: Import the XUL trees and ensure their integrity.
 */
(function importXulTrees() {
  var xulTreesScope = {
    "exports": xulTrees,
    "C": C,
    "appID": Services.appinfo.ID
  };

  Services.scriptloader.loadSubScript(
      'chrome://rpcontinued/content/ui/xul-trees.js',
      xulTreesScope);

  // For ensuring that each Element Spec has an ID.
  var nextID = 1;

  // Call the "ensureIntegrity" function on _all_ element specs
  // of _all_ trees.
  for (let treeName in xulTrees) {
    recursivelyGetAllElementSpecs(xulTrees[treeName]).forEach(ensureIntegrity);
  }

  function ensureIntegrity(aElementSpec) {
    // Ensure "attributes" exists.
    if (!aElementSpec.hasOwnProperty("attributes")) {
      aElementSpec.attributes = {};
    }

    // Ensure the Element Spec has an ID attribute.
    if (!aElementSpec.attributes.hasOwnProperty("id")) {
      aElementSpec.attributes.id = "rpc-autoid-" + nextID++;
      //Logger.dump("Automatically created ID '" + aElementSpec.attributes.id +
      //            "' for element <" + aElementSpec.tag + ">");
    }
  }
}());


/**
 * @param {Array<Object>} aElementSpecList
 *
 * @return {Array<Object>}
 */
function recursivelyGetAllElementSpecs(aElementSpecList) {
  // Create a new array.
  var allElementSpecs = [];

  for (let elementSpec of aElementSpecList) {
    if (!elementSpec) {
      Logger.warning(Logger.TYPE_ERROR, "An element spec is null!");
      continue;
    }

    // Add this element spec.
    allElementSpecs.push(elementSpec);

    // Add all children recursively.
    if (elementSpec.hasOwnProperty("children")) {
      let allChildrenSpecs = recursivelyGetAllElementSpecs(
          elementSpec.children);
      allElementSpecs = allElementSpecs.concat(allChildrenSpecs);
    }
  }

  return allElementSpecs;
}


function getParentElement(aDocument, aElementSpec) {
  if (!aElementSpec.parent) {
    return false;
  } else {
    if (aElementSpec.parent.id) {
      return aDocument.getElementById(aElementSpec.parent.id);
    } else if (aElementSpec.parent.special) {
      switch (aElementSpec.parent.special.type) {
        case "__window__":
          return aDocument.querySelector("window");

        case "subobject":
          let subobjectTree = aElementSpec.parent.special.tree;
          let parentElement = aDocument.getElementById(aElementSpec.parent
                                                                   .special.id);
          for (let i = 0, len = subobjectTree.length; i < len; ++i) {
            parentElement = parentElement[subobjectTree[i]];
          }
          return parentElement;

        default:
          return false;
      }
    } else {
      return false;
    }
  }
}

/**
 * Get the localized value of an attribute.
 */
function getLocalizedValue(aRawValue) {
  if (typeof aRawValue !== "string") {
    return aRawValue;
  }

  if (aRawValue.charAt(0) !== "&" ||
      aRawValue.slice(-1) !== ";") {
    return aRawValue;
  }

  try {
    let name = aRawValue.slice(1, -1);
    return StringUtils.$str(name);
  } catch (e) {
    Logger.severe(Logger.TYPE_INTERNAL, "It was not possible to get the " +
                  "localized value for '" + aRawValue + "'. " +
                  "The error was: " + e, e);
    return aRawValue;
  }
}

/**
 * @param {Element} aElement
 * @param {!Object} aElementSpec
 */
function setAttributes(aElement, aElementSpec) {
  if (!aElementSpec.hasOwnProperty("attributes")) {
    return;
  }
  for (let attributeName in aElementSpec.attributes) {
    let value = getLocalizedValue(aElementSpec.attributes[attributeName]);
    if (value) {
      aElement.setAttribute(attributeName, value);
    }
  }
}

var {addEventListeners, removeEventListeners} = (function () {
  /**
   * @param {!Object} aRootObject
   * @param {Array<string>} aListenerSpec
   *
   * @return {Function} The listener function.
   */
  function getEventListener(aRootObject, aListenerSpec) {
    var object = aRootObject;
    for (let propertyName of aListenerSpec) {
      if (!object.hasOwnProperty(propertyName)) {
        return null;
      }
      object = object[propertyName];
    }
    return object;
  }

  /**
   * @param {Element} aEventTarget
   * @param {Object} aEventList
   *
   * @return {Array}
   */
  function getEventInfoList(aEventTarget, aEventList) {
    if (!aEventList) {
      return [];
    }
    var rootObject = aEventTarget.ownerDocument.defaultView.rpcontinued;

    return Object.keys(aEventList).map(function (eventName) {
      return [
        eventName,
        getEventListener(rootObject, aEventList[eventName])
      ];
    });
  }

  /**
   * @param {Element} aEventTarget The event target.
   * @param {!Object} aElementSpec
   * @param {Object} aElementSpec.events
   */
  function addEventListeners(aEventTarget, {events}) {
    var listeners = getEventInfoList(aEventTarget, events);
    listeners.forEach(function ([eventName, listener]) {
      aEventTarget.addEventListener(eventName, listener, false);
    });
  }

  function removeEventListeners(aEventTarget, {events}) {
    var listeners = getEventInfoList(aEventTarget, events);
    listeners.forEach(function ([eventName, listener]) {
      aEventTarget.removeEventListener(eventName, listener, false);
    });
  }

  return {
    addEventListeners: addEventListeners,
    removeEventListeners: removeEventListeners
  };
}());


function recursivelyAddXULElements(aDocument, aElementSpecList,
                                   aParentElement = null) {
  for (let elementSpec of aElementSpecList) {
    if (!elementSpec || !elementSpec.tag) {
      Logger.warning(Logger.TYPE_ERROR, "Element spec incomplete!");
      continue;
    }
    let parentElement = !!aParentElement ? aParentElement :
        getParentElement(aDocument, elementSpec);
    if (false === parentElement) {
      Logger.warning(Logger.TYPE_ERROR, "The parent element could not " +
                     "be determined. Tag: " + elementSpec.tag + "; " +
                     "ID: " + elementSpec.attributes.id);
      continue;
    }
    if (parentElement === null) {
      Logger.warning(Logger.TYPE_ERROR,
                     "parentElement of '" + elementSpec.attributes.id +
                     "' is null!");
      continue;
    }

    // Create the new element.
    let newElement = aDocument.createElement(elementSpec.tag);

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

XULUtils.addTreeElementsToWindow = function(aWin, aTreeName) {
  if (xulTrees.hasOwnProperty(aTreeName)) {
    recursivelyAddXULElements(aWin.document, xulTrees[aTreeName]);
  }
};

/**
 * Return a list of the IDs of the specified tree's root elements.
 *
 * @param {string} aTreeName
 * @return {Array<string>} The list of IDs.
 */
function getRootElementIDs(aTreeName) {
  var ids = xulTrees[aTreeName].map(function (aElementSpec) {
    return aElementSpec.attributes.id;
  });
  return ids;
}

XULUtils.removeTreeElementsFromWindow = function(aWin, aTreeName) {
  if (!xulTrees.hasOwnProperty(aTreeName)) {
    Logger.warning(Logger.TYPE_ERROR, "There's no tree with name '" +
                   aTreeName + "'.");
    return;
  }

  var $id = aWin.document.getElementById.bind(aWin.document);

  // Recursively remove all event listeners.
  for (let elementSpec of recursivelyGetAllElementSpecs(xulTrees[aTreeName])) {
    let eventTarget = $id(elementSpec.attributes.id);
    removeEventListeners(eventTarget, elementSpec);
  }

  // Remove the root elements.
  for (let id of getRootElementIDs(aTreeName)) {
    let node = $id(id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
};
