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

import {rp} from "app/app.background";
import {log} from "app/log";
import { API } from "bootstrap/api/interfaces";
import {C} from "data/constants";
import * as XpcomUtils from "legacy/lib/utils/xpcom-utils";
import {Environment, MainEnvironment} from "lib/environment";
import {ManagerForPrefObservers} from "lib/manager-for-pref-observer";
import * as RequestProcessor from "lib/request-processor";
import {
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
} from "lib/subscription";
import * as RuleUtils from "lib/utils/rule-utils";
import * as WindowUtils from "lib/utils/window-utils";
import * as Metadata from "models/metadata";
import {Requests} from "models/requests";

declare const LegacyApi: API.ILegacyApi;

export const BackgroundPage = {
  C,
  Environment,
  LegacyApi,
  MainEnvironment,
  ManagerForPrefObservers,
  Metadata,
  RequestProcessor,
  Requests,
  RuleUtils,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  WindowUtils,
  XpcomUtils,
  log,
  rp,
};
