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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/utils/strings",
  "lib/utils/constants"
], this);

let EXPORTED_SYMBOLS = ["XULUtils"];

let XULUtils = {};

let xulTrees = XULUtils.xulTrees = {};

let xulTreesScope = {
  "exports": xulTrees,
  "C": C,
  "appID": Services.appinfo.ID
};

Services.scriptloader.loadSubScript(
    'chrome://rpcontinued/content/ui/xul-trees.js',
    xulTreesScope);


function getParentElement(doc, element) {
  if (!element.parent) {
    return false;
  } else {
    if (element.parent.id) {
      return doc.getElementById(element.parent.id);
    } else if (element.parent.special) {
      switch (element.parent.special.type) {
        case "__window__":
          return doc.querySelector("window");

        case "subobject":
          let subobjectTree = element.parent.special.tree;
          let parentElement = doc.getElementById(element.parent.special.id);
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

function isAttribute(element, attr) {
  return attr != "children" && attr != "parent" && attr != "tag" &&
          element.hasOwnProperty(attr);
}

function getAttrValue(element, attr) {
  if (!isAttribute(element, attr)) {
    return false;
  }
  let value = element[attr];
  if (value.charAt(0) == "&" && value.charAt(value.length-1) == ";") {
    try {
      value = StringUtils.$str(value.substr(1, value.length-2));
    } catch (e) {
      Logger.severe(Logger.TYPE_ERROR, e, e);
      return false;
    }
  }
  return value;
}

function setAttributes(node, element) {
  for (let attr in element) {
    let value = getAttrValue(element, attr);
    if (value) {
      node.setAttribute(attr, value);
    }
  }
}


function recursivelyAddXULElements(doc, elements, parentElement=null) {
  let parentElementIsSet = !!parentElement;

  for (let i in elements) {
    let element = elements[i];

    if (!element || !element.tag) {
      continue;
    }
    parentElement = parentElementIsSet ? parentElement :
        getParentElement(doc, element);
    if (false === parentElement) {
      continue;
    }
    if (parentElement === null) {
      Logger.warning(Logger.TYPE_ERROR,
                     "parentElement of '"+element.id+"' is null!");
      continue;
    }

    let newElem = doc.createElement(element.tag);
    setAttributes(newElem, element);
    if (element.children) {
      recursivelyAddXULElements(doc, element.children, newElem);
    }
    parentElement.appendChild(newElem);
  }
};

XULUtils.addTreeElementsToWindow = function(win, treeName) {
  if (xulTrees.hasOwnProperty(treeName)) {
    recursivelyAddXULElements(win.document, xulTrees[treeName]);
  }
}

let elementIDsToRemove = {};

function getElementIDsToRemove(treeName) {
  if (elementIDsToRemove.hasOwnProperty(treeName)) {
    return elementIDsToRemove[treeName];
  }
  let ids = elementIDsToRemove[treeName] = [];
  let tree = xulTrees[treeName];
  for (let i in tree) {
    ids.push(tree[i].id);
  }
  return ids;
}

XULUtils.removeTreeElementsFromWindow = function(win, treeName) {
  if (!xulTrees.hasOwnProperty(treeName)) {
    return;
  }
  let tree = xulTrees[treeName];
  let elementIDs = getElementIDsToRemove(treeName);

  for (let i in elementIDs) {
    let id = elementIDs[i];
    let node = win.document.getElementById(id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
}
