/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = [
  "EXTENSION_ID",
  "FIREFOX_ID",
  "MMID",

  "APP_STARTUP",
  "APP_SHUTDOWN",
  "ADDON_ENABLE",
  "ADDON_DISABLE",
  "ADDON_INSTALL",
  "ADDON_UNINSTALL",
  "ADDON_UPGRADE",
  "ADDON_DOWNGRADE",

  "CP_OK",
  "CP_REJECT",

  "RULE_ACTION_ALLOW",
  "RULE_ACTION_DENY"
];

const EXTENSION_ID = "requestpolicy@requestpolicy.com";
const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
const MMID = EXTENSION_ID; // message manager ID

// reason constants for startup(), shutdown(), install() and uninstall()
// see https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions#Reason_constants
const APP_STARTUP = 1; // The application is starting up.
const APP_SHUTDOWN = 2; // The application is shutting down.
const ADDON_ENABLE = 3; // The add-on is being enabled.
const ADDON_DISABLE = 4; // The add-on is being disabled. (Also sent during uninstallation)
const ADDON_INSTALL = 5; // The add-on is being installed.
const ADDON_UNINSTALL = 6; // The add-on is being uninstalled.
const ADDON_UPGRADE = 7; // The add-on is being upgraded.
const ADDON_DOWNGRADE = 8; // The add-on is being downgraded.

// content policy
const CP_OK = Ci.nsIContentPolicy.ACCEPT;
const CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

const RULE_ACTION_ALLOW = 1;
const RULE_ACTION_DENY = 2;
