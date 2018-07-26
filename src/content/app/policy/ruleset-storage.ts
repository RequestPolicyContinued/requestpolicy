/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import { App } from "app/interfaces";
import { Common } from "common/interfaces";
import {Module} from "lib/classes/module";
import {RawRuleset} from "./ruleset";

export class RulesetStorage extends Module {
  constructor(
      log: Common.ILog,
      private storageArea: browser.storage.StorageArea,
      private uriService: App.services.IUriService,
  ) {
    super("RulesetStorage", log);
  }

  public loadRawRulesetFromFile(
      policyName: string,
      subscriptionListName?: string,
  ) {
    const key = this.getKey(policyName, subscriptionListName);
    const pResult = this.storageArea.get(key);
    const pRawRuleset = pResult.then((aResult) => {
      if (!aResult.hasOwnProperty(key)) return null;
      return RawRuleset.create(this.log, this.uriService, aResult[key]);
    });
    pRawRuleset.catch((e) => {
      this.log.error("RulesetStorage.loadRawRulesetFromFile():", e);
    });
    return pRawRuleset;
  }

  public saveRawRulesetToFile(
      policy: RawRuleset,
      policyName: string,
      subscriptionListName?: string,
  ) {
    const key = this.getKey(policyName, subscriptionListName);
    const p = this.storageArea.set({
      [key]: policy.data as any, // FIXME (as any)
    });
    p.catch((e) => {
      this.log.error("RulesetStorage.saveRawRulesetToFile():", e);
    });
  }

  private getKey(policyName: string, subscriptionListName?: string) {
    let key = "policies/";
    if (subscriptionListName) {
      key += `subscriptions/${subscriptionListName}/`;
    }
    key += policyName;
    return key;
  }
}
