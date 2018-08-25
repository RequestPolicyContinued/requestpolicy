/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
 * Copyright (c) 2014-2017 Martin Kimmerle
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

(function() {
  // We use window.top because the popup can be embedded in a frame
  let overlay = window.parent.rpcontinued.overlay;
  let menu = window.parent.rpcontinued.menu;
  let $id = document.getElementById.bind(document);

  // Listener for origin domain selection
  $id("rpc-origin").addEventListener("click",
      menu.itemSelected, false);

  // Listener for revoke temporary permission link
  $id("rpc-revoke-temporary-permissions").addEventListener("click",
      overlay.revokeTemporaryPermissions.bind(overlay), false);

  // Listeners for the footer links
  let toggleLinkBlocking = function(event) {
    let disabled = overlay.toggleTemporarilyAllowAll();
    $id("rpc-link-enable-blocking").hidden = !disabled;
    $id("rpc-link-disable-blocking").hidden = disabled;
  };

  $id("rpc-link-enable-blocking").addEventListener("click",
      toggleLinkBlocking, false);

  $id("rpc-link-disable-blocking").addEventListener("click",
      toggleLinkBlocking, false);

  $id("rpc-link-help").addEventListener("click",
      overlay.openHelp.bind(overlay), false);

  $id("rpc-link-prefs").addEventListener("click",
      overlay.openPrefs.bind(overlay), false);

  $id("rpc-link-policies").addEventListener("click",
      overlay.openPolicyManager.bind(overlay), false);

  $id("rpc-link-request-log").addEventListener("click",
      overlay.toggleRequestLog.bind(overlay), false);

  // If the popup is embedded in a frame, we add a mutation observer
  // to resize the frame on DOM changes
  if (window !== window.parent) {
    let observer = new MutationObserver(function() {
      let popupframe = window.parent.document.getElementById("rpc-popup-frame");
      if (popupframe) {
        let frameContentDiv = $id("rpc-contents");
        let contentHeight = frameContentDiv.scrollHeight;
        let contentWidth = frameContentDiv.scrollWidth;

        if (contentWidth && contentWidth !== 0) {
          popupframe.style.width = `${contentWidth}px`;
        }
        if (contentHeight && contentHeight !== 0) {
          popupframe.style.height = `${contentHeight}px`;
        }
      }
    });

    let mutationTarget = $id("rpc-contents");
    let confObserver = {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    };
    observer.observe(mutationTarget, confObserver);
  }
})();
