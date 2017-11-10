/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

declare const LegacyApi: any;

import {C} from "content/data/constants";
import {OldRules} from "content/lib/classes/old-rules";
import {Environment, MainEnvironment} from "content/lib/environment";
import {ManagerForPrefObservers} from "content/lib/manager-for-pref-observer";
import {PolicyManager} from "content/lib/policy-manager";
import {RequestProcessor} from "content/lib/request-processor";
import {
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
} from "content/lib/subscription";
import * as DomainUtil from "content/lib/utils/domain-utils";
import * as RuleUtils from "content/lib/utils/rule-utils";
import * as StringUtils from "content/lib/utils/string-utils";
import * as WindowUtils from "content/lib/utils/window-utils";
import {rpService} from "content/main/requestpolicy-service";
import {Log} from "content/models/log";
import {Requests} from "content/models/requests";
import {Storage} from "content/models/storage";
import {VersionInfos} from "content/models/version-infos";

export const BackgroundPage = {
  C,
  DomainUtil,
  Environment,
  LegacyApi,
  Log,
  MainEnvironment,
  ManagerForPrefObservers,
  OldRules,
  PolicyManager,
  RequestProcessor,
  Requests,
  RuleUtils,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  Storage,
  StringUtils,
  VersionInfos,
  WindowUtils,
  rpService,
};
