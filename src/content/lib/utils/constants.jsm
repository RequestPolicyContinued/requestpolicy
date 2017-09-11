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

/* global Components */
const {interfaces: Ci} = Components;

/* exported C */
this.EXPORTED_SYMBOLS = ["C"];

var C = {};

// @ifdef AMO
C.EXTENSION_ID = "rpcontinued@amo.requestpolicy.org";
// @endif
// @ifndef AMO
C.EXTENSION_ID = "rpcontinued@non-amo.requestpolicy.org";
// @endif

C.FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
C.SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
// We need Math.random because of https://bugzilla.mozilla.org/show_bug.cgi?id=1202125
C.MMID = C.EXTENSION_ID + "_" + Math.random(); // message manager ID
C.MM_PREFIX = C.MMID + ":";

// reason constants for startup(), shutdown(), install() and uninstall()
// see https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions#Reason_constants
C.APP_STARTUP = 1; // The application is starting up.
C.APP_SHUTDOWN = 2; // The application is shutting down.
C.ADDON_ENABLE = 3; // The add-on is being enabled.
C.ADDON_DISABLE = 4; // The add-on is being disabled. (Also sent during uninstallation)
C.ADDON_INSTALL = 5; // The add-on is being installed.
C.ADDON_UNINSTALL = 6; // The add-on is being uninstalled.
C.ADDON_UPGRADE = 7; // The add-on is being upgraded.
C.ADDON_DOWNGRADE = 8; // The add-on is being downgraded.

// content policy
C.CP_OK = Ci.nsIContentPolicy.ACCEPT;
C.CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

C.RULE_ACTION_ALLOW = 1;
C.RULE_ACTION_DENY = 2;
