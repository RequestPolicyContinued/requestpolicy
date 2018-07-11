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

import { dAsyncSettings, log } from "app/log";
import { RPContentServices } from "app/services/services.module.content";
import { UriService } from "app/services/uri-service";
import { Storage } from "app/storage/storage.module";
import { JSMs } from "bootstrap/api/interfaces";
import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { AppContent } from "./app.content.module";
import { AsyncSettings } from "./storage/async-settings";
import { SETTING_SPECS } from "./storage/setting-specs";

declare const Services: JSMs.Services;

const storageReadyPromise = Promise.resolve();

const xpconnectService = new XPConnectService();
const uriService = new UriService(log, "AppContent", Services.eTLD,
    xpconnectService.getIDNService(), Services.io);
const rpServices = new RPContentServices(log, uriService);

const asyncSettings = new AsyncSettings(
    log,
    browser.storage,
    browser.storage.local,
    SETTING_SPECS.defaultValues,
    storageReadyPromise,
);
dAsyncSettings.resolve(asyncSettings);
const storage = new Storage(log, asyncSettings, null, storageReadyPromise);
export const rp = new AppContent(
    log,
    rpServices,
    storage,
);
