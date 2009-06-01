/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Personas.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Myk Melez <myk@mozilla.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * This module wraps the incompatible Gecko 1.9.0 (Firefox 3.0) and Gecko 1.9.1
 * (Firefox 3.5) JSON APIs, presenting the Gecko 1.9.1 API on both versions,
 * for extensions that support multiple versions of Gecko-based applications.
 *
 * Import this module into your extension to parse and stringify JSON in both
 * Firefox 3.0 and 3.5 (and other Gecko-based applications, like Thunderbird)
 * without checking the application's version each time.
 *
 * Note: don't import this into the global namespace!  If you do, you'll hork
 * native application code that expects the Gecko 1.9.0 API.  Instead, import it
 * into your own object like this:
 *
 *   let MyExtension = {
 *     JSON: null,
 *     ...
 *   };
 *   Components.utils.import("chrome://myextension/modules/JSON.js", MyExtension);
 *   // Now MyExtension.JSON is an object implementing the Gecko 1.9.1 JSON API.
 *
 * The Gecko 1.9.1 (Firefox 3.5) JSON API is documented in the article:
 *   https://developer.mozilla.org/En/Using_JSON_in_Firefox
 */

let EXPORTED_SYMBOLS = ["JSON"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

// Iceweasel 3.0 has a bug where it reports its platform version as 1.9 instead
// of 1.9.0.n; we work around the bug by checking for 1.9 in addition to 1.9.0.n
// and wrapping the JSON API in both cases.
if (appInfo.platformVersion.indexOf("1.9.0") == 0 ||
    appInfo.platformVersion == "1.9") {
  // Declare JSON with |var| so it'll be defined outside the enclosing
  // conditional block.
  var JSON = {
      JSON: null,
      parse: function(jsonString) { return this.JSON.fromString(jsonString) },
      stringify: function(jsObject) { return this.JSON.toString(jsObject) }
  }
  Cu.import("resource://gre/modules/JSON.jsm", JSON);
}
