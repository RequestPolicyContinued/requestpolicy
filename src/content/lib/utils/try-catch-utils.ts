/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

/**
 * Functions with expected exceptions.
 *
 * Sometimes, when debugging, it's useful to pause on _any_ exception.
 * Pausing on expected exceptions is not useful. Add this file to the debugger's
 * list of files to be skipped.
 */

declare const Ci: any;

import * as WindowUtils from "content/lib/utils/window-utils";

const value = <T = any>(val: T) => ({value: val});
const error = <T = any>(err: T) => ({error: err, value: null});

// tslint:disable-next-line:interface-name
interface RV {
  value: any;
  error?: any;
}

//
// xpcom
//

export function queryInterface(object: any, interf: any): RV {
  try {
    return value(object.QueryInterface(interf));
  } catch (e) {
    return error(e);
  }
}

//
// http channel
//

export function getDocShellFromHttpChannel(httpChannel: any) {
  try {
    return value(httpChannel.notificationCallbacks.
        QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDocShell));
  } catch (e) {
    return error(e);
  }
}

export function getLoadContextFromHttpChannel(httpChannel: any) {
  // more info on the load context:
  // https://developer.mozilla.org/en-US/Firefox/Releases/
  //   3.5/Updating_extensions

  /* start - be careful when editing here */
  try {
    /* eslint-disable new-cap */
    return value(httpChannel.notificationCallbacks.
        QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsILoadContext));
    /* eslint-enable new-cap */
  } catch (ex) {
    try {
      return value(httpChannel.loadGroup.notificationCallbacks.
          getInterface(Ci.nsILoadContext));
    } catch (ex2) {
      // FIXME: the Load Context can't be found in case a favicon
      //        request is redirected, that is, the server responds
      //        with a 'Location' header when the server's
      //        `favicon.ico` is requested.
      return error(ex2);
    }
  }
  /* end - be careful when editing here */
}

export function getRequestHeaderFromHttpChannel(
    httpChannel: any,
    header: string,
) {
  try {
    return value(httpChannel.getRequestHeader("X-moz"));
  } catch (e) {
    return error(e);
  }
}

//
// other
//

export function getComplexValueFromPrefBranch(
    prefBranch: any,
    prefName: string,
    type: any,
) {
  try {
    return prefBranch.getComplexValue(prefName, type).data;
  } catch (e) {
    return error(e);
  }
}

export function getBrowserFromLoadContext(loadContext: any) {
  try {
    if (loadContext.topFrameElement) {
      // the top frame element should be already the browser element
      return value(loadContext.topFrameElement);
    } else {
      // we hope the associated window is available. in multiprocessor
      // firefox it's not available.
      return value(WindowUtils.getBrowserForWindow(loadContext.topWindow));
    }
  } catch (e) {
    return error(e);
  }
}

export function addSessionHistoryListener(gBrowser: any, listener: any): RV {
  try {
    gBrowser.webNavigation.sessionHistory.addSHistoryListener(listener);
    return value(null);
  } catch (e) {
    return error(e);
  }
}

export function removeSessionHistoryListener(gBrowser: any, listener: any): RV {
  try {
    gBrowser.webNavigation.sessionHistory.removeSHistoryListener(listener);
    return value(null);
  } catch (e) {
    return error(e);
  }
}
