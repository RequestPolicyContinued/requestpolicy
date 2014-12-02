/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

var MMID = "requestpolicy@requestpolicy.com";

Components.utils.import("resource://gre/modules/Services.jsm");
/*
let scope = (function() {
  let self = {};




  // Listen for click events so that we can allow requests that result from
  // user-initiated link clicks and form submissions.
  addEventListener("click", function(event) {
    // If mozInputSource is undefined or zero, then this was a javascript-generated event.
    // If there is a way to forge mozInputSource from javascript, then that could be used
    // to bypass RequestPolicy.
    if (!event.mozInputSource) {
      return;
    }
    // The following show up as button value 0 for links and form input submit buttons:
    // * left-clicks
    // * enter key while focused
    // * space bar while focused (no event sent for links in this case)
    if (event.button != 0) {
      return;
    }
    // Link clicked.
    // I believe an empty href always gets filled in with the current URL so
    // it will never actually be empty. However, I don't know this for certain.
    if (event.target.nodeName.toLowerCase() == "a" && event.target.href) {
      sendSyncMessage(MMID + ":notifyLinkClicked",
                      {origin: event.target.ownerDocument.URL,
                       dest: event.target.href});
      return;
    }
    // Form submit button clicked. This can either be directly (e.g. mouseclick,
    // enter/space while the the submit button has focus) or indirectly (e.g.
    // pressing enter when a text input has focus).
    if (event.target.nodeName.toLowerCase() == "input" &&
        event.target.type.toLowerCase() == "submit" &&
        event.target.form && event.target.form.action) {
      sendSyncMessage(MMID + ":registerFormSubmitted",
                      {origin: event.target.ownerDocument.URL,
                       dest: event.target.form.action});
      return;
    }
  }, true);*/

  addMessageListener(MMID + ":reload", function() {
    content.document.location.reload(false);
  });

  addMessageListener(MMID + ":setLocation", function(message) {
    let location = content.document.location;
    // When refreshing a page that wants to redirect, sometimes the
    // targetDocument.location is null. If that's the case, just use
    // do the redirection in the current content pane.
    if (location == null) {
      //dump("in setLocation: content.document.location == null, " +
      //    "using content.location instead");
      location = content.location;
    }
    location.href = message.data.uri;
  });
/*
  return self;
}());*/

Services.scriptloader.loadSubScript(
    'chrome://requestpolicy/content/ui/frame.blocked-content.js');
Services.scriptloader.loadSubScript(
    'chrome://requestpolicy/content/ui/frame.dom-content-loaded.js');
Services.scriptloader.loadSubScript(
    'chrome://requestpolicy/content/ui/frame.doc-manager.js');
