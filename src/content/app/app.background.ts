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
import { API, JSMs, XPCOM } from "bootstrap/api/interfaces";
import {JSMService} from "bootstrap/api/services/jsm-service";
import {
  StorageMigrationToWebExtension,
} from "legacy/app/migration/storage-migration-to-we";
import {V0RulesMigration} from "legacy/app/migration/v0-rules-migration";
declare const LegacyApi: API.ILegacyApi;
declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Cr: XPCOM.nsXPCComponents_Results;
declare const Cu: XPCOM.nsXPCComponents_Utils;
declare const ComponentsID: XPCOM.nsXPCComponents["ID"];
declare const XPCOMUtils: JSMs.XPCOMUtils;

interface IEmbeddedWebExtension { browser: typeof browser; }
declare const _pEmbeddedWebExtension: Promise<IEmbeddedWebExtension>;
// @endif

import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { C } from "data/constants";
import { Connection } from "lib/classes/connection";
import { NormalRequest, RedirectRequest } from "lib/request";
import * as RequestProcessor from "lib/request-processor";
import * as compareVersions from "lib/third-party/mozilla-version-comparator";
import { getPortFromSlaveConnectable } from "lib/utils/connection-utils";
import { AppBackground } from "./app.background.module";
import { BrowserSettings } from "./browser-settings/browser-settings.module";
import { dAsyncSettings, log } from "./log";
import { Migration } from "./migration/migration.module";
import { SettingsMigration } from "./migration/storage/settings-migration";
import {
  StorageMigration,
} from "./migration/storage/storage-migration.module";
import { Policy } from "./policy/policy.module";
import { RulesetStorage } from "./policy/ruleset-storage";
import { Subscriptions } from "./policy/subscriptions";
import { Runtime } from "./runtime/runtime.module";
import { RequestService } from "./services/request-service";
import { RulesServices } from "./services/rules/rules-services.module";
import { V0RulesService } from "./services/rules/v0-rules-service";
import { RPServices } from "./services/services.module";
import { UriService } from "./services/uri-service";
import { VersionInfoService } from "./services/version-info-service";
import { AsyncSettings } from "./storage/async-settings";
import { CachedSettings } from "./storage/cached-settings";
import { SETTING_SPECS } from "./storage/setting-specs";
import { Storage } from "./storage/storage.module";
import { InitialSetup } from "./ui/initial-setup";
import { Ui } from "./ui/ui.module";
import { RPChannelEventSink } from "./web-request/channel-event-sink";
import { RPContentPolicy } from "./web-request/content-policy";
import { WebRequest } from "./web-request/web-request.module";

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

const localStorageArea = browser.storage.local;

const {pEWEConnection, pWebextStorageMigration}: {
  pWebextStorageMigration:
      Promise<StorageMigrationToWebExtension | null>,
  pEWEConnection: Promise<Connection<any, any> | null>,
} = C.EXTENSION_TYPE === "legacy" ? (() => {
  // @if EXTENSION_TYPE='legacy'
  const getEWEModules = (ewe: IEmbeddedWebExtension) => {
    const eweBrowser = ewe.browser;
    const promiseEwePort = () => {
      return getPortFromSlaveConnectable(eweBrowser.runtime);
    };
    const rvEWEConnection = new Connection(
        C.EWE_CONNECTION_LEGACY_ID,
        log,
        C.EWE_CONNECTION_EWE_ID,
        promiseEwePort,
    );
    const rvWebextStorageMigration = new StorageMigrationToWebExtension(
        log,
        browser.storage.local,
        browser.storage.onChanged,
        rvEWEConnection.whenReady.then(() => rvEWEConnection),
    );
    return {
      eweConnection: rvEWEConnection,
      webextStorageMigration: rvWebextStorageMigration,
    };
  };

  const pModules = _pEmbeddedWebExtension.then(
      getEWEModules,
      () => ({
        eweConnection: null,
        webextStorageMigration: null,
      }),
  );
  return {
    pEWEConnection: pModules.then(({eweConnection}) => eweConnection),
    pWebextStorageMigration: pModules.
        then(({webextStorageMigration}) => webextStorageMigration),
  };
  // @endif
})() : {
  pEWEConnection: Promise.resolve(null),
  pWebextStorageMigration: Promise.resolve(null),
};

const settingsMigration = new SettingsMigration(
    log,
    browser.storage.local,
    pWebextStorageMigration,
);
const storageReadyPromise = settingsMigration.whenReady;

const jsmService = C.EXTENSION_TYPE === "legacy" ? new JSMService(Cu) : null;
const mozServices = C.EXTENSION_TYPE === "legacy" ?
    jsmService!.getServices() : null;
const xpcApi = C.EXTENSION_TYPE === "legacy" ? {
  prefsService: mozServices!.prefs,
  rpPrefBranch: LegacyApi.rpPrefBranch,
  tryCatchUtils: LegacyApi.tryCatchUtils,
} : null;

const rulesetStorage = new RulesetStorage(log, localStorageArea);
const subscriptions = new Subscriptions(log, rulesetStorage, localStorageArea);
const policy = new Policy(log, subscriptions, rulesetStorage);
const runtime = new Runtime(log, pEWEConnection);

const asyncSettings = new AsyncSettings(
    log,
    browser.storage,
    browser.storage.local,
    SETTING_SPECS.defaultValues,
    storageReadyPromise,
);
dAsyncSettings.resolve(asyncSettings);
const cachedSettings = new CachedSettings(
    log,
    SETTING_SPECS,
    storageReadyPromise,
    browser.storage.local,
    LegacyApi.rpPrefBranch, /* FIXME */
);
const storage = new Storage(
    log, asyncSettings, cachedSettings, storageReadyPromise,
);

const browserSettings = new BrowserSettings(
    log, cachedSettings,
    (browser as any).privacy.network,
);

const xpconnectService = new XPConnectService();
const uriService = new UriService(log, undefined, mozServices!.eTLD,
    xpconnectService.getIDNService(), mozServices!.io);
const requestService = new RequestService(log, uriService, cachedSettings);
const v0RulesService = new V0RulesService(
    log,
    uriService,
    xpcApi,
);
const rulesServices = new RulesServices(log, v0RulesService);
const versionComparator = { compare: compareVersions };
const versionInfoService = new VersionInfoService(
    log, versionComparator, cachedSettings,
    browser.management,
    browser.runtime,
);
const rpServices = new RPServices(
    log, requestService, rulesServices, uriService, versionInfoService,
);

const v0RulesMigration = C.EXTENSION_TYPE === "legacy" ?
    new V0RulesMigration(
        log, policy, v0RulesService, versionInfoService,
    ) : null;
const storageMigration = new StorageMigration(
    log,
    settingsMigration,
    v0RulesMigration,
    pWebextStorageMigration,
);

const migration = new Migration(log, storageMigration);

const initialSetup = new InitialSetup(
    log, cachedSettings, versionInfoService, xpcApi! /* FIXME */,
);
const ui = new Ui(log, initialSetup);

const redirectRequestFactory = (
    aOldChannel: XPCOM.nsIChannel,
    aNewChannel: XPCOM.nsIChannel,
    aFlags: number,
) => new RedirectRequest(aOldChannel, aNewChannel, aFlags);
const normalRequestFactory = (
    aContentType: any,
    aContentLocation: any,
    aRequestOrigin: any,
    aContext: any,
    aMimeTypeGuess: any,
    aExtra: any,
    aRequestPrincipal: any,
) => new NormalRequest(
    aContentType, aContentLocation, aRequestOrigin,
    aContext, aMimeTypeGuess, aExtra, aRequestPrincipal,
);
const rpChannelEventSink = new RPChannelEventSink(
    log, xpconnectService, Ci, Cr, ComponentsID, XPCOMUtils,
    RequestProcessor, redirectRequestFactory,
);
const rpContentPolicy = new RPContentPolicy(
    log, xpconnectService, Ci, Cr, ComponentsID, XPCOMUtils,
    RequestProcessor, normalRequestFactory,
);
const rpWebRequest = new WebRequest(log, rpChannelEventSink, rpContentPolicy);

export const rp = new AppBackground(
    log,
    browserSettings,
    migration,
    policy,
    runtime,
    rpServices,
    storage,
    ui,
    rpWebRequest,
);
