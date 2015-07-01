/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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

/**
 * Note: The string utils are used also in the content process (see
 * e10s/multiprocessor firefox), so this file shouldn't contain code which is
 * limited to the chrome process.
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["StringUtils"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");


let StringUtils = (function() {
  let self = {};

  XPCOMUtils.defineLazyGetter(self, "strbundle", function() {
    return loadPropertiesFile(
        "chrome://rpcontinued/locale/requestpolicy.properties");
  });
  // from https://developer.mozilla.org/en-US/Add-ons/
  // How_to_convert_an_overlay_extension_to_restartless
  // #Step_10.3A_Bypass_cache_when_loading_properties_files
  function loadPropertiesFile(path)
  {
    /* HACK: The string bundle cache is cleared on addon shutdown, however it
     * doesn't appear to do so reliably. Errors can erratically happen on next
     * load of the same file in certain instances. (at minimum, when strings are
     * added/removed) The apparently accepted solution to reliably load new
     * versions is to always create bundles with a unique URL so as to bypass the
     * cache. This is accomplished by passing a random number in a parameter after
     * a '?'. (this random ID is otherwise ignored) The loaded string bundle is
     * still cached on startup and should still be cleared out of the cache on
     * addon shutdown. This just bypasses the built-in cache for repeated loads of
     * the same path so that a newly installed update loads cleanly. */
    return Services.strings.createBundle(path + "?" + Math.random());
  }

  self.$str = function(aName, aParams) {
    if (!!aParams) {
      return self.strbundle.formatStringFromName(aName, aParams,
                                                 aParams.length);
    } else {
      return self.strbundle.GetStringFromName(aName);
    }
  };

  return self;
}());
