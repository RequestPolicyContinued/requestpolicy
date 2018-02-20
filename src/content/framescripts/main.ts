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

let allControllers: Array<{[key: string]: any}> = [];

// import the Log first! It needs to get logging prefs from storage (async).
import {LogController} from "controllers/log-controller";
import {Controllers} from "lib/classes/controllers";
{
  const controllers = [LogController];
  (new Controllers(controllers)).startup();
  allControllers = allControllers.concat(controllers);
}
import { Log } from "models/log";
const log = Log.instance;

import "framescripts/blocked-content";
import "framescripts/dom-content-loaded";
import "framescripts/misc";

import {
  COMMONJS_UNLOAD_SUBJECT,
} from "legacy/lib/commonjs-unload-subject";

// @if BUILD_ALIAS='ui-testing'
import "ui-testing/services";
// @endif

import {rp} from "app/app.content";
import {Level as EnvLevel, MainEnvironment} from "lib/environment";

// =============================================================================

MainEnvironment.addStartupFunction(EnvLevel.INTERFACE, () => {
  // shut down the framescript on the message manager"s
  // `unload`. That event will occur when the browsing context
  // (e.g. the tab) has been closed.
  MainEnvironment.obMan.observeSingleTopic("sdk:loader:destroy",
                                           (subject: any) => {
    if (subject.wrappedJSObject === COMMONJS_UNLOAD_SUBJECT) {
      MainEnvironment.shutdown();
      rp.shutdown().catch(log.onError("framescript shutdown"));
      (new Controllers(allControllers)).shutdown();
    }
  });
});

rp.startup().catch(log.onError("framescript startup"));
MainEnvironment.startup();
