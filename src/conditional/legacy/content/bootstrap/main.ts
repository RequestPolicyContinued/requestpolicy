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

// Before anything else, handle default preferences. This is necessary because
// bootsrapped addons have to handle their default preferences manually,
// see Mozilla Bug 564675.
import {
  DefaultPreferencesController,
} from "bootstrap/controllers/default-preferences-controller";
DefaultPreferencesController.startup();

import * as TryCatchUtils from "lib/utils/try-catch-utils";
import { Log } from "models/log";
import { Api } from "./api/api.module";
import { Extension } from "./api/extension";
import { AsyncLocaleData } from "./api/i18n/async-locale-data";
import { I18n } from "./api/i18n/i18n.module";
import { API, JSMs } from "./api/interfaces";
import { Management } from "./api/management";
import { Manifest } from "./api/manifest";
import { MiscInfos } from "./api/misc-infos";
import { Runtime } from "./api/runtime";
import { ChromeFileService } from "./api/services/chrome-file-service";
import { FileService } from "./api/services/file-service";
import { XPConnectService } from "./api/services/xpconnect-service";
import { JsonStorage } from "./api/storage/json-storage";
import { PrefBranch, PrefTypes } from "./api/storage/pref-branch";
import { PrefObserver } from "./api/storage/pref-observer";
import { Prefs } from "./api/storage/prefs";
import { Storage } from "./api/storage/storage.module";
import { SyncLocalStorageArea } from "./api/storage/sync-local-storage-area";

declare const Services: JSMs.Services;

const {
  NetUtil: mozNetUtil,
} = Cu.import("resource://gre/modules/NetUtil.jsm") as {
  NetUtil: JSMs.NetUtil,
};
const mozHttp = Cu.import("resource://gre/modules/Http.jsm") as JSMs.Http;
const {
  FileUtils: mozFileUtils,
} = Cu.import("resource://gre/modules/FileUtils.jsm") as {
  FileUtils: JSMs.FileUtils,
};

const log = Log.instance;

const extension = new Extension(log);
const xpconnectService = new XPConnectService();
const fileService = new FileService(xpconnectService, mozFileUtils);
const chromeFileService = new ChromeFileService(mozNetUtil, mozHttp);
const localeData = new AsyncLocaleData(TryCatchUtils, chromeFileService);
const i18n = new I18n(log, localeData);
const management = new Management(log);
const manifest = new Manifest(log, chromeFileService);
const runtime = new Runtime(log);

const prefBranchFactory: API.storage.PrefBranchFactory = (
  branchRoot: string,
  namesToTypesMap: {[key: string]: PrefTypes},
) => new PrefBranch(Services.prefs, branchRoot, namesToTypesMap);

const prefs = new Prefs(Services.prefs, prefBranchFactory);

const prefObserverFactory: API.storage.PrefObserverFactory =
    () => new PrefObserver(prefs);

const jsonPrefs = new JsonStorage(fileService);
const slsa = new SyncLocalStorageArea(prefs, jsonPrefs);
const storage = new Storage(log, slsa);
const miscInfos = new MiscInfos(Services.appinfo, prefs, Services.vc);

export const api = new Api(
    log,
    extension,
    i18n,
    management,
    manifest,
    runtime,
    storage,
    miscInfos,
    prefs,
    prefObserverFactory,
);
