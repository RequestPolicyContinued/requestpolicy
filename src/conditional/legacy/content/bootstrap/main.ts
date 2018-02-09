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

import { Api } from "bootstrap/models/api";
import { Extension } from "bootstrap/models/api/extension";
import { I18n } from "bootstrap/models/api/i18n";
import { Management } from "bootstrap/models/api/management";
import { Runtime } from "bootstrap/models/api/runtime";
import { Storage } from "bootstrap/models/api/storage";
import { Manifest } from "bootstrap/models/manifest";
import { Log } from "models/log";

const log = Log.instance;

const extension = new Extension(log);
const i18n = new I18n(log);
const management = new Management(log);
const manifest = new Manifest(log);
const runtime = new Runtime(log);
const storage = new Storage(log);

export const api = new Api(
    log,
    extension,
    i18n,
    management,
    manifest,
    runtime,
    storage,
);
