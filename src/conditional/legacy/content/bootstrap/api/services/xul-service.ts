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

/// <reference path="./xul-service.d.ts" />

import { App } from "app/interfaces";
import { API, XUL } from "bootstrap/api/interfaces";
import { matchKeyPattern, updateString } from "legacy/lib/utils/l10n-utils";
import { objectEntries } from "lib/utils/js-utils";
import { getMaybeIncompleteXulTreeLists } from "ui/xul-trees";

export class XulService implements API.services.IXulService {
  constructor(
      private i18n: API.i18n.II18n,
  ) {
    return;
  }

  public addTreeElementsToWindow(
      aWin: XUL.chromeWindow,
      aTree: IXulTree[],
  ) {
    this.recursivelyAddXULElements(aWin.document, aTree);
  }

  public removeTreeElementsFromWindow(
      aWin: XUL.chromeWindow,
      aTree: IXulTree[],
  ) {
    const $id = aWin.document.getElementById.bind(aWin.document);

    // Recursively remove all event listeners.
    const elementSpecs = this.recursivelyGetAllElementSpecs(aTree);
    for (const elementSpec of elementSpecs) {
      const {id} = elementSpec.attributes;
      const eventTarget = $id(id);
      if (!eventTarget) {
        console.error(`Could not find element with ID "${id}".`);
        continue;
      }
      this.removeEventListeners(eventTarget, elementSpec);
    }

    // Remove the root elements.
    for (const id of this.getRootElementIDs(aTree)) {
      const node = $id(id);
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }

  public getXulTreeLists(
      overlay: App.windows.window.IOverlay,
  ): IXulTreeLists {
    const maybeIncompleteXulTrees = getMaybeIncompleteXulTreeLists(overlay);

    // For ensuring that each Element Spec has an ID.
    let nextID = 1;

    // Call the "ensureIntegrity" function on _all_ element specs
    // of _all_ trees.
    // tslint:disable-next-line:forin
    for (const treeName in maybeIncompleteXulTrees) {
      this.recursivelyGetAllElementSpecs(maybeIncompleteXulTrees[treeName]).
          forEach(ensureIntegrity);
    }

    return maybeIncompleteXulTrees as IXulTreeLists;

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
  }

  private recursivelyGetAllElementSpecs<
      T = IXulElementSpec
  >(aElementSpecList: T[]): T[];
  private recursivelyGetAllElementSpecs<
      T = IMaybeIncompleteXulElementSpec
  >(aElementSpecList: T[]): T[];
  private recursivelyGetAllElementSpecs<
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
        const allChildrenSpecs = this.recursivelyGetAllElementSpecs<T>(
            (elementSpec.children! as T[]),
        );
        allElementSpecs = allElementSpecs.concat(allChildrenSpecs);
      }
    }

    return allElementSpecs;
  }

  private getParentElementOfSubobject(
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

  private isRootXulElementSpec(
      aElementSpec: RootOrNonrootXulElementSpec,
  ): aElementSpec is IXulTree {
    return "parent" in aElementSpec;
  }

  private getParentElement(
      aDocument: XUL.chromeDocument,
      aElementSpec: RootOrNonrootXulElementSpec,
  ): Element | null | false {
    if (!this.isRootXulElementSpec(aElementSpec)) return false;
    if ("id" in aElementSpec.parent) {
      return aDocument.getElementById(aElementSpec.parent.id);
    } else if (aElementSpec.parent.special) {
      switch (aElementSpec.parent.special.type) {
        case "__window__":
          return aDocument.querySelector("window");

        case "subobject":
          return this.getParentElementOfSubobject(
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
  private getLocalizedValue(aRawValue: string): string {
    if (!matchKeyPattern(aRawValue)) {
      return aRawValue;
    }
    return updateString(this.i18n, aRawValue);
  }

  private setAttributes(aElement: Element, aElementSpec: IXulElementSpec) {
    if (!("attributes" in aElementSpec)) return;
    // tslint:disable-next-line:forin
    for (const attributeName in aElementSpec.attributes) {
      const value = this.getLocalizedValue(
          aElementSpec.attributes[attributeName],
      );
      if (value) {
        aElement.setAttribute(attributeName, value);
      }
    }
  }

  private getEventInfoList(
      aEventList: IXulElementSpec["events"],
  ): Array<[string, () => void]> {
    return Array.from(objectEntries(aEventList || {}));
  }

  private addEventListeners(
      aEventTarget: Element,
      {events}: IXulElementSpec,
  ) {
    const listeners = this.getEventInfoList(events);
    listeners.forEach(([eventName, listener]) => {
      aEventTarget.addEventListener(eventName, listener, false);
    });
  }

  private removeEventListeners(
      aEventTarget: Element,
      {events}: IXulElementSpec,
  ) {
    const listeners = this.getEventInfoList(events);
    listeners.forEach(([eventName, listener]) => {
      aEventTarget.removeEventListener(eventName, listener, false);
    });
  }

  private recursivelyAddXULElements(
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
          this.getParentElement(aDocument, elementSpec);
      if (false === parentElement) {
        console.error(
            `The parent element could not be determined. ` +
            `Tag: ${elementSpec.tag}; ` +
            `ID: ${elementSpec.attributes.id}`,
        );
        continue;
      }
      if (parentElement === null) {
        console.error(
            `parentElement of '${elementSpec.attributes.id}' ` +
            `(tag: '${elementSpec.tag}') is null!`);
        const specDebug = Object.assign({}, elementSpec);
        delete specDebug.attributes;
        delete specDebug.children;
        delete specDebug.events;
        console.dir(specDebug);
        continue;
      }

      // Create the new element.
      const newElement = aDocument.createElement(elementSpec.tag);

      // Set all attributes.
      this.setAttributes(newElement, elementSpec);

      // Add all event listeners.
      this.addEventListeners(newElement, elementSpec);

      // Recurse.
      if (elementSpec.children) {
        this.recursivelyAddXULElements(
            aDocument,
            elementSpec.children,
            newElement,
        );
      }
      parentElement.appendChild(newElement);
    }
  }

  /**
   * Return a list of the IDs of the specified tree's root elements.
   */
  private getRootElementIDs(aTree: IXulTree[]): string[] {
    const ids = aTree.map((aElementSpec) => {
      return aElementSpec.attributes.id;
    });
    return ids;
  }
}
