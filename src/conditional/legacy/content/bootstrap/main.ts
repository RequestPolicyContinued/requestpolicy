/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import { Log } from "lib/classes/log";
import * as tryCatchUtils from "lib/utils/try-catch-utils";
import { Api } from "./api/api.module";
import { Extension } from "./api/extension";
import { AsyncLocaleData } from "./api/i18n/async-locale-data";
import { I18n } from "./api/i18n/i18n.module";
import { API, JSMs, XPCOM } from "./api/interfaces";
import { Management } from "./api/management";
import { Manifest } from "./api/manifest";
import { MiscInfos } from "./api/misc-infos";
import {
  NetworkPredictionEnabledSetting,
} from "./api/privacy/network-prediction-enabled";
import { PrivacyApi } from "./api/privacy/privacy.module";
import { RuntimeApi } from "./api/runtime-api";
import { ChromeFileService } from "./api/services/chrome-file-service";
import { FileService } from "./api/services/file-service";
import { JSMService } from "./api/services/jsm-service";
import { XPConnectService } from "./api/services/xpconnect-service";
import { XulService } from "./api/services/xul-service";
import { JsonStorage } from "./api/storage/json-storage";
import { PrefBranch } from "./api/storage/pref-branch";
import { PrefObserver } from "./api/storage/pref-observer";
import { Storage } from "./api/storage/storage.module";
import { SyncLocalStorageArea } from "./api/storage/sync-local-storage-area";

const log = new Log();

declare const Services: JSMs.Services;
declare const Ci: XPCOM.nsXPCComponents_Interfaces;

const jsmService = new JSMService(Cu);
const mozAddonManager = jsmService.getAddonManager();
const mozNetUtil = jsmService.getNetUtil();
const mozHttp = jsmService.getHttp();
const mozFileUtils = jsmService.getFileUtils();
const mozServices = jsmService.getServices();

const extension = new Extension(log);
const xpconnectService = new XPConnectService();
const fileService = new FileService(xpconnectService, mozFileUtils);
const chromeFileService = new ChromeFileService(mozNetUtil, mozHttp);
const localeData = new AsyncLocaleData(
    log,
    tryCatchUtils,
    chromeFileService,
    mozServices,
);
const i18n = new I18n(log, localeData);
const xulService = new XulService(i18n);
const management = new Management(log, mozAddonManager);
const manifest = new Manifest(log, chromeFileService);
const runtimeApi = new RuntimeApi(log, Services.appinfo);

const createPrefBranch = (
    branchRoot: string,
) => new PrefBranch(Ci, Services.prefs, xpconnectService, branchRoot);
const rootPrefBranch = createPrefBranch("");
const rpPrefBranch = createPrefBranch("extensions.requestpolicy.");

const networkPredictionEnabled = new NetworkPredictionEnabledSetting(
    log, rootPrefBranch,
);
const privacy = new PrivacyApi(log, networkPredictionEnabled);

const prefObserverFactory: API.storage.PrefObserverFactory =
    () => new PrefObserver(rpPrefBranch);

const jsonPrefs = new JsonStorage(fileService);
const slsa = new SyncLocalStorageArea(
    Services.prefs, rpPrefBranch, jsonPrefs,
);
const storage = new Storage(log, slsa, rpPrefBranch);
const miscInfos = new MiscInfos(
    Services.appinfo, rpPrefBranch, Services.vc,
);

export const api = new Api(
    log,
    extension,
    i18n,
    management,
    manifest,
    privacy,
    runtimeApi,
    storage,
    Services.prefs,
    miscInfos,
    rpPrefBranch,
    prefObserverFactory,
    tryCatchUtils,
    xulService,
);
