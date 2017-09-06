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

/* global RUN_ID */ // see bootstrap.jsm

const env = str => str[0] !== "undefined";

export var C = {
  LOG_ENVIRONMENT: env`/* @echo LOG_ENVIRONMENT */`,
  LOG_EVENT_LISTENERS: env`/* @echo LOG_EVENT_LISTENERS */`,
  LOG_FLAG_STATE: env`/* @echo LOG_FLAG_STATE */`,
  LOG_GETTING_SAVED_REQUESTS: env`/* @echo LOG_GETTING_SAVED_REQUESTS */`,
  LOG_MESSAGE_LISTENERS: env`/* @echo LOG_MESSAGE_LISTENERS */`,
  LOG_REQUESTS: env`/* @echo LOG_REQUESTS */`,

  AMO: env`/* @echo AMO */`,
  UI_TESTING: env`/* @echo UI_TESTING */`,
};

C.EXTENSION_ID = "/* @echo EXTENSION_ID */";

C.FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
C.SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
// We need a random RUN_ID because of https://bugzilla.mozilla.org/show_bug.cgi?id=1202125
C.MMID = C.EXTENSION_ID + "_" + RUN_ID; // message manager ID
C.MM_PREFIX = C.MMID + ":";

// content policy
C.CP_OK = Ci.nsIContentPolicy.ACCEPT;
C.CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

C.RULE_ACTION_ALLOW = 1;
C.RULE_ACTION_DENY = 2;
