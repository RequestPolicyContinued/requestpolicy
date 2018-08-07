/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

import { App } from "app/interfaces";
import { API, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { BoundMethods } from "lib/classes/bound-methods";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {
  getKeyAttributesFromCombo,
  IError,
  IKeyAttributes,
} from "lib/utils/xul-keyboard-shortcut-utils";

interface IElementAttributes {
  disabled: "true" | "false" | null;
  modifiers: string | null;
  key: string | null;
}

const ELEMENT_ATTRIBUTES_WHEN_DISABLED: IElementAttributes = {
  disabled: "true",
  key: "",
  modifiers: "",
};

/**
 * Overview of events:
 *
 * Init:
 * - determine attributes
 * - create element (all windows)          \  load into
 * - set element attributes (all windows)  /  window
 *
 * New window:
 * - create element (this window)          \  load into
 * - set element attributes (this window)  /  window
 *
 * Pref changed:
 * - determine attributes
 * - set element attributes (all windows)
 */

export class KeyboardShortcutModule extends Module
    implements API.windows.window.IKeyboardShortcutModule {
  private elementID = `rpKey_${this.id}`;

  private elementAttributes: IElementAttributes = {
    disabled: null,
    key: null,
    modifiers: null,
  };

  private boundMethods = new BoundMethods(this);
  private prefObserver = this.createPrefObserver();

  protected get startupPreconditions() {
    return [
      this.cachedSettings.whenReady,
      this.xulTrees.whenReady,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      windowID: number,
      private window: XUL.chromeWindow,
      private readonly createPrefObserver: API.storage.PrefObserverFactory,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly xulTrees: App.windows.window.IXulTrees,
      private id: string,
      private defaultCombo: string,
      private callback: (window: XUL.chromeWindow) => void,
      private userEnabledPrefName: string,
      private userComboPrefName: string,
  ) {
    super(
        `app.windows.window[${windowID}].keyboardShortcut.${id}`,
        parentLog,
    );
  }

  public get userCombo() {
    return this.cachedSettings.get(this.userComboPrefName);
  }

  public get userEnabled() {
    return this.cachedSettings.get(this.userEnabledPrefName);
  }

  // ---------------------------------------------------------------------------
  // main methods
  // ---------------------------------------------------------------------------

  protected startupSelf() {
    this.determineElementAttributes();

    this.createElement();
    this.setElementAttributes();

    this.prefObserver.addListeners([
      this.userEnabledPrefName,
      this.userComboPrefName,
    ], this.boundMethods.get(this.onPrefChange));

    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    this.removeElement();
    this.prefObserver.removeAllListeners();
    return MaybePromise.resolve(undefined);
  }

  private onPress(event: Event) {
    const window = (event.target as Element).ownerDocument.defaultView;
    this.callback.call(null, window);
  }

  private onPrefChange() {
    this.determineElementAttributes();
    this.setElementAttributes();

    // Each time one of the key's attributes changes it's necessary to
    // newly append the keyset to it's parent. Otherwise the
    // keyboard shortcut doesn't get updated!
    const keyset = this.window.document.getElementById("rpcontinuedKeyset")!;
    keyset.parentNode!.appendChild(keyset);
  }

  // ---------------------------------------------------------------------------
  // assisting methods
  // ---------------------------------------------------------------------------

  private createElement() {
    const keyset = this.window.document.getElementById("rpcontinuedKeyset")!;
    const element = this.window.document.createElement("key");
    element.setAttribute("id", this.elementID);
    element.setAttribute("disabled", "true");
    // "oncommand" (or "command") is required! See
    // https://stackoverflow.com/a/16786770/307637
    element.setAttribute("oncommand", "void(0);");
    element.addEventListener(
        "command",
        this.boundMethods.get(this.onPress),
        false,
    );
    keyset.appendChild(element);
  }

  private setElementAttributes() {
    const element = this.window.document.getElementById(this.elementID)!;

    element.setAttribute("modifiers", this.elementAttributes.modifiers!);
    element.setAttribute("key", this.elementAttributes.key!);
    element.setAttribute("disabled", this.elementAttributes.disabled!);
  }

  private removeElement() {
    const element = this.window.document.getElementById(this.elementID)!;
    element.removeEventListener(
        "command",
        this.boundMethods.get(this.onPress),
        false,
    );
    element.remove();
  }

  private determineElementAttributes() {
    if (!this.userEnabled) {
      this.elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
      return;
    }

    let combo = this.userCombo;
    if (combo === "default") {
      combo = this.defaultCombo;
    }
    if (combo === "none") {
      this.elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
      return;
    }

    // tslint:disable-next-line:variable-name
    const rv_ = getKeyAttributesFromCombo(combo);
    if (false === rv_.success) {
      const rv = rv_ as IError;
      console.error("Error parsing keyboard combination for shortcut " +
          `"${this.id}": ${rv.errorMessage}`);
      this.elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
      return;
    } else {
      const rv = rv_ as IKeyAttributes;
      this.elementAttributes = {
        disabled: "false",
        key: rv.key,
        modifiers: rv.modifiers,
      };
    }
  }
}
