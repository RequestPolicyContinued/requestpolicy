Components.utils.import("resource://requestpolicy/Logger.jsm");

/**
 * Updates the status bar icons in each window.
 */
function statusbarIconChanged(iconStyle) {
  for (var i = 0; i < Application.windows.length; i++) {
    // It seems that _window should be treated as privite, but it's there and it
    // is what we want.
    var window = Application.windows[i]._window;
    if (window.requestpolicyOverlay) {
      window.requestpolicyOverlay.setStatusbarIconStyle(iconStyle);
    }
  }
}
