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

import { JSMs, XPCOM } from "bootstrap/api/interfaces";

export class JSMService {
  constructor(
      private readonly cu: XPCOM.nsXPCComponents_Utils,
  ) {}

  public getAddonManager(): JSMs.AddonManager {
    return this.import("resource://gre/modules/AddonManager.jsm").AddonManager;
  }

  public getFileUtils(): JSMs.FileUtils {
    return this.import("resource://gre/modules/FileUtils.jsm").FileUtils;
  }

  public getHttp(): JSMs.Http {
    return this.import("resource://gre/modules/Http.jsm");
  }

  public getNetUtil(): JSMs.NetUtil {
    return this.import("resource://gre/modules/NetUtil.jsm").NetUtil;
  }

  public getPrivateBrowsingUtils(): JSMs.PrivateBrowsingUtils {
    return this.import("resource://gre/modules/PrivateBrowsingUtils.jsm").
        PrivateBrowsingUtils;
  }

  public getServices(): JSMs.Services {
    return this.import("resource://gre/modules/Services.jsm").Services;
  }

  private import(uri: string): any {
    return this.cu.import(uri, {});
  }
}
