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

// @if EXTENSION_TYPE='legacy'
import { API, XPCOM } from "bootstrap/api/interfaces";
import {JSMService} from "bootstrap/api/services/jsm-service";
import {V0RulesMigration} from "legacy/app/migration/v0-rules-migration";
declare const LegacyApi: API.ILegacyApi;
declare const Cu: XPCOM.nsXPCComponents_Utils;
// @endif

import { SettingsMigration } from "app/migration/settings-migration";
import { RulesServices } from "app/services/rules/rules-services.module";
import { V0RulesService } from "app/services/rules/v0-rules-service";
import { VersionInfoService } from "app/services/version-info-service";
import { InitialSetup } from "app/ui/initial-setup";
import { C } from "data/constants";
import { RPLog } from "lib/classes/rp-log";
import * as compareVersions from "lib/third-party/mozilla-version-comparator";
import { defer } from "lib/utils/js-utils";
import { AppBackground } from "./app.background.module";
import { BrowserSettings } from "./browser-settings/browser-settings.module";
import { Migration } from "./migration/migration.module";
import { Policy } from "./policy/policy.module";
import { RulesetStorage } from "./policy/ruleset-storage";
import { Subscriptions } from "./policy/subscriptions";
import { RPServices } from "./services/services.module";
import { UriService } from "./services/uri-service";
import { Storage } from "./storage/cached-settings";
import * as RPStorageConfig from "./storage/setting-specs";
import { Ui } from "./ui/ui.module";

//
// NOTES ABOUT BUILD-SPECIFIC (or optional) MODULES:
//
// 1. All optional modules should be defined as `const` using ternary operator.
// 2. All optional modules should fall back to `null` if unused or not
//    applicable. Do **not** use `undefined`.
//
// Rule 1+2 combined will ensure that nobody forgets to pass an optional
// module to the constructor of another module. (Optional constructor
// parameters are `undefined` and can be forgotten, `null` cannot.)
//

const dStorageReady = defer<void>();
const storageReadyPromise = dStorageReady.promise;
export const log = new RPLog(browser.storage.local, storageReadyPromise);
const settingsMigration = new SettingsMigration(log, browser.storage.local);
dStorageReady.resolve(settingsMigration.whenReady);

const jsmService = C.EXTENSION_TYPE === "legacy" ? new JSMService(Cu) : null;
const mozServices = C.EXTENSION_TYPE === "legacy" ?
    jsmService!.getServices() : null;
const xpcApi = C.EXTENSION_TYPE === "legacy" ? {
  prefsService: mozServices!.prefs,
  rpPrefBranch: LegacyApi.rpPrefBranch,
  tryCatchUtils: LegacyApi.tryCatchUtils,
} : null;

const rulesetStorage = new RulesetStorage(log);
const subscriptions = new Subscriptions(log, rulesetStorage);
const policy = new Policy(log, subscriptions, rulesetStorage);

const storage = new Storage(
    log, RPStorageConfig, storageReadyPromise,
);

const browserSettings = new BrowserSettings(
    log, storage,
    (browser as any).privacy.network,
);

const uriService = new UriService(log);
const v0RulesService = new V0RulesService(
    log,
    uriService,
    xpcApi,
);
const rulesServices = new RulesServices(log, v0RulesService);
const versionComparator = { compare: compareVersions };
const versionInfoService = new VersionInfoService(
    log, versionComparator, storage,
);
const rpServices = new RPServices(
    log, rulesServices, uriService, versionInfoService,
);

const v0RulesMigration = C.EXTENSION_TYPE === "legacy" ?
    new V0RulesMigration(
        log, policy, v0RulesService, versionInfoService,
    ) : null;

const migration = new Migration(log, settingsMigration, v0RulesMigration);

const initialSetup = new InitialSetup(log, storage, versionInfoService);
const ui = new Ui(log, initialSetup);

export const rp = new AppBackground(
    log,
    browserSettings,
    migration,
    policy,
    rpServices,
    storage,
    ui,
);
