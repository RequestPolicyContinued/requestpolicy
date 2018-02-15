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

import {rp} from "app/background/app.background";
import {C} from "data/constants";
import {OldRules} from "lib/classes/old-rules";
import {Environment, MainEnvironment} from "lib/environment";
import {ManagerForPrefObservers} from "lib/manager-for-pref-observer";
import * as RequestProcessor from "lib/request-processor";
import {
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
} from "lib/subscription";
import * as DomainUtil from "lib/utils/domain-utils";
import * as RuleUtils from "lib/utils/rule-utils";
import * as WindowUtils from "lib/utils/window-utils";
import {Log} from "models/log";
import * as Metadata from "models/metadata";
import {Requests} from "models/requests";
import {VersionInfos} from "models/version-infos";

export const BackgroundPage = {
  C,
  DomainUtil,
  Environment,
  LegacyApi,
  Log,
  MainEnvironment,
  ManagerForPrefObservers,
  Metadata,
  OldRules,
  RequestProcessor,
  Requests,
  RuleUtils,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  VersionInfos,
  WindowUtils,
  rp,
};
