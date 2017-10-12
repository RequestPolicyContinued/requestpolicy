/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import "content/framescripts/blocked-content";
import "content/framescripts/dom-content-loaded";
import "content/framescripts/misc";

import {C} from "content/lib/utils/constants";

declare const require: (path: string) => void;

if (C.UI_TESTING) {
  // tslint:disable-next-line:no-var-requires
  require("content/ui-testing/services");
}

import {Environment, MainEnvironment} from "content/lib/environment";

// tslint:disable-next-line:no-var-requires
const unloadSubject = require("@loader/unload");

// =============================================================================

MainEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE, () => {
  // shut down the framescript on the message manager"s
  // `unload`. That event will occur when the browsing context
  // (e.g. the tab) has been closed.
  MainEnvironment.obMan.observeSingleTopic("sdk:loader:destroy",
                                           (subject: any) => {
    if (subject.wrappedJSObject === unloadSubject) {
      MainEnvironment.shutdown();
    }
  });
});

MainEnvironment.startup();
