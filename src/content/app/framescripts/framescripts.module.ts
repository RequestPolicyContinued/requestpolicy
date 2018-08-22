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

import { App } from "app/interfaces";
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class Framescripts extends Module implements App.IFramescripts {
  private frameScriptURI =
      `chrome://rpcontinued/content/bootstrap-environments/framescript.js` +
      `?${Math.random()}`;

  protected get subModules() {
    return {
      // init the FramescriptServices _before_ loading the framescripts
      framescriptServices: this.framescriptServices,
    };
  }

  constructor(
      parentLog: Common.ILog,
      private framescriptServices: App.framescripts.IFramescriptServices,
      private globalFrameMessageManager: XPCOM.GlobalFrameMessageManager,
  ) {
    super("app.framescrips", parentLog);
  }

  protected startupSelf() {
    // Load the framescript into all existing tabs.
    // Also tell the globalMM to load it into each new
    // tab from now on.
    this.globalFrameMessageManager.loadFrameScript(this.frameScriptURI, true);
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf(): void {
    // Stop loading framescripts into new tabs.
    // --------------------------
    // Note that it's not necessary to tell the framescripts'
    // environments to shut down. Instead:
    // - In case the window is closed, the framescript will shut
    //   down on the ContentFrameMessageManager's "unload" event.
    // - In case the addon is being disabled or firefox gets quit,
    //   the ParentProcessEnvironment will send a message to all
    //   children.
    this.globalFrameMessageManager.
        removeDelayedFrameScript(this.frameScriptURI);
  }
}
