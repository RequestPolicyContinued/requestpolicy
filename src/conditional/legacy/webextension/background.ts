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

import { EweModule } from "app/ewe.module";
import {
  StorageMigrationFromXpcom,
} from "controllers/storage-migration-from-xpcom";
import { C } from "data/constants";
import { Connection } from "lib/classes/connection";
import { Log, LogLevel } from "lib/classes/log";
import { getPortFromMasterConnectable } from "lib/utils/connection-utils";

const rootLog = new Log({
  enabled: true,
  level: LogLevel.ALL,
});
const log = rootLog.extend({name: "ewe"});
const portGetterLog = rootLog.extend({name: "ewe.getPortFromConnectable"});
const promiseLegacyPort = () => getPortFromMasterConnectable(
    portGetterLog,
    portGetterLog,
    browser.runtime,
);
const legacyConnection = new Connection(
    C.EWE_CONNECTION_EWE_ID,
    rootLog,
    C.EWE_CONNECTION_LEGACY_ID,
    promiseLegacyPort,
);
const storageMigrationFromXpcom = new StorageMigrationFromXpcom(
    rootLog,
    legacyConnection.whenReady.then(() => legacyConnection),
    browser.storage,
);
const ewe = new EweModule(
    rootLog,
    legacyConnection,
    storageMigrationFromXpcom,
);

ewe.startup().catch(log.onError("EWE startup failed"));

window.addEventListener("unload", () => {
  // Only synchronous tasks can be done here.
  ewe.shutdown().catch(log.onError("EWE shutdown failed"));
});
