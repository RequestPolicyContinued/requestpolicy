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

import { StorageApiWrapper } from "app/storage/storage-api-wrapper";
import { JSMs, XPCOM } from "bootstrap/api/interfaces";
import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { MessageListenerModule } from "lib/classes/message-listener-module";
import { getDOMWindowUtils } from "lib/utils/window-utils";
import { AppContent } from "./app.content.module";
import { ManagerForBlockedContent } from "./contentscript/blocked-content";
import { ContentscriptModule } from "./contentscript/contentscript.module";
import { ManagerForDOMContentLoaded } from "./contentscript/dom-content-loaded";
import {
  FramescriptToBackgroundCommunication,
} from "./contentscript/framescript-to-background-communication";
import { ContentscriptMisc } from "./contentscript/misc";
import { dAsyncSettings, log } from "./log";
import { RPContentServices } from "./services/services.module.content";
import { UriService } from "./services/uri-service";
import { AsyncSettings } from "./storage/async-settings";
import { SETTING_SPECS } from "./storage/setting-specs";
import { Storage } from "./storage/storage.module";

declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Services: JSMs.Services;
declare const cfmm: XPCOM.ContentFrameMessageManager;

const domWindowUtils = getDOMWindowUtils(cfmm.content);
const {outerWindowID} = domWindowUtils;

// FIXME: ask the background if the storage is indeed ready
// tslint:disable-next-line:max-line-length
const storageApiWrapper = new StorageApiWrapper(
    outerWindowID,
    log,
    browser.storage,  // badword-linter:allow:browser.storage:
    Promise.resolve(), // <-- FIXME
);

const msgListener = new MessageListenerModule(
    `AppContent[${outerWindowID}].contentSide`,
    log,
    cfmm,
);
const bgCommunication = new FramescriptToBackgroundCommunication(
    log,
    outerWindowID,
    cfmm,
    msgListener,
);
const blockedContent = new ManagerForBlockedContent(log, outerWindowID);
const xpconnectService = new XPConnectService();
const uriService = new UriService(
    log,
    outerWindowID,
    Services.eTLD,
    xpconnectService.getIDNService(),
    Services.io,
);
const domContentLoaded = new ManagerForDOMContentLoaded(
    log,
    outerWindowID,
    Ci,
    cfmm,
    bgCommunication,
    blockedContent,
    uriService,
);
const contentscriptMisc = new ContentscriptMisc(
    log,
    outerWindowID,
    cfmm,
    bgCommunication,
    msgListener,
);
const contentSide = new ContentscriptModule(
    log,
    outerWindowID,
    bgCommunication,
    blockedContent,
    domContentLoaded,
    contentscriptMisc,
);

const rpServices = new RPContentServices(log, outerWindowID, uriService);

const asyncSettings = new AsyncSettings(
    log,
    outerWindowID,
    storageApiWrapper,
    SETTING_SPECS.defaultValues,
);
dAsyncSettings.resolve(asyncSettings);
const storage = new Storage(
    log,
    outerWindowID,
    storageApiWrapper,
    asyncSettings,
    null,
);
export const rp = new AppContent(
    log,
    outerWindowID,
    contentSide,
    rpServices,
    storage,
);
