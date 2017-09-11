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

import "framescripts/misc.js";
import "framescripts/blocked-content.js";
import "framescripts/dom-content-loaded.js";

// @ifdef UI_TESTING
import "ui-testing/services";
// @endif

import {Environment, MainEnvironment} from "lib/environment";

const unloadSubject = require("@loader/unload");

//==============================================================================

MainEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE, function() {
  // shut down the framescript on the message manager"s
  // `unload`. That event will occur when the browsing context
  // (e.g. the tab) has been closed.
  MainEnvironment.obMan.observeSingleTopic("sdk:loader:destroy", (subject) => {
    if (subject.wrappedJSObject === unloadSubject) {
      MainEnvironment.shutdown();
    }
  });
});

MainEnvironment.startup();
