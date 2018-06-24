/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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

import { XPCOM } from "bootstrap/api/interfaces";

declare const Cc: XPCOM.nsXPCComponents_Classes;
declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Cm: XPCOM.nsXPCComponents_Manager;

export class XPConnectService {
  public createConverterInputStreamInstance(): XPCOM.nsIConverterInputStream {
    return Cc["@mozilla.org/intl/converter-input-stream;1"].
        createInstance(Ci.nsIConverterInputStream);
  }

  public createConverterOutputStreamInstance(): XPCOM.nsIConverterOutputStream {
    return Cc["@mozilla.org/intl/converter-output-stream;1"].
        createInstance(Ci.nsIConverterOutputStream);
  }

  public createFileInputStreamInstance(): XPCOM.nsIFileInputStream {
    return Cc["@mozilla.org/network/file-input-stream;1"].
        createInstance(Ci.nsIFileInputStream);
  }

  public createFileOutputStreamInstance(): XPCOM.nsIFileOutputStream {
    return Cc["@mozilla.org/network/file-output-stream;1"].
        createInstance(Ci.nsIFileOutputStream);
  }

  public createSupportsStringInstance(): XPCOM.nsISupportsString {
    return Cc["@mozilla.org/supports-string;1"].
        createInstance(Ci.nsISupportsString);
  }

  // services

  public getCategoryManagerService(): XPCOM.nsICategoryManager {
    return Cc["@mozilla.org/categorymanager;1"].
        getService<XPCOM.nsICategoryManager>(Ci.nsICategoryManager);
  }

  // other

  public getComponentRegistrar(): XPCOM.nsIComponentRegistrar {
    return Cm.QueryInterface(Ci.nsIComponentRegistrar);
  }
}
