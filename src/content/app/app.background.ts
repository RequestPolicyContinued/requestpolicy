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

import { RulesServices } from "app/services/rules/rules-services.module";
import { V0RulesService } from "app/services/rules/v0-rules-service";
import { RPServices } from "app/services/services.module";
import { InitialSetup } from "app/ui/initial-setup";
import { Log } from "models/log";
import { AppBackground } from "./app.background.module";
import { Policy } from "./policy/policy.module";
import { RulesetStorage } from "./policy/ruleset-storage";
import { Subscriptions } from "./policy/subscriptions";
import * as RPStorageConfig from "./storage/rp-config.background";
import { Storage } from "./storage/storage.module";
import { Ui } from "./ui/ui.module";

const log = Log.instance;

const rulesetStorage = new RulesetStorage(log);
const subscriptions = new Subscriptions(log, rulesetStorage);
const policy = new Policy(log, subscriptions, rulesetStorage);

const v0RulesService = new V0RulesService(log);
const rulesServices = new RulesServices(log, v0RulesService);
const rpServices = new RPServices(log, rulesServices);

const storage = new Storage(log, RPStorageConfig);

const initialSetup = new InitialSetup(log, storage);
const ui = new Ui(log, initialSetup);

export const rp = new AppBackground(
    log,
    policy,
    rpServices,
    storage,
    ui,
);
