(function() {
  // We use window.top because the popup can be embedded in a frame
  let overlay = window.top.rpcontinued.overlay;
  let menu = window.top.window.rpcontinued.menu;
  let $id = document.getElementById.bind(document);

  // Listener for origin domain selection
  $id("rpc-origin").addEventListener("click",
      menu.itemSelected, false);

  // Listener for revoke temporary permission link
  $id("rpc-revoke-temporary-permissions").addEventListener("click",
      overlay.revokeTemporaryPermissions, false);

  // Listeners for the footer links
  $id("rpc-link-enable-blocking").addEventListener("click",
      overlay.toggleTemporarilyAllowAll, false);

  $id("rpc-link-disable-blocking").addEventListener("click",
      overlay.toggleTemporarilyAllowAll, false);

  $id("rpc-link-help").addEventListener("click",
      overlay.openHelp, false);

  $id("rpc-link-prefs").addEventListener("click",
      overlay.openPrefs, false);

  $id("rpc-link-policies").addEventListener("click",
      overlay.openPolicyManager, false);

  $id("rpc-link-request-log").addEventListener("click",
      overlay.toggleRequestLog, false);

  // If the popup is embedded in a frame, we add a mutation observer
  // to resize the frame when DOM changes
  if (window !== window.top) {
    let mutationTarget = $id("rpc-contents");
    let observer = new window.MutationObserver(overlay.updatePopupFrameSize);
    let confObserver = {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    };
    observer.observe(mutationTarget, confObserver);
  }
})();
