/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = [
  "ProcessEnvironment",
  // Not only ProcessEnvironment is exported, but also `Environment`. This
  // might be helpful somewhere.
  "Environment"
];

Cu.import("resource://gre/modules/Services.jsm");

let globalScope = this;

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "main/environment-manager",
  "lib/environment"
], globalScope);

let envName = EnvironmentManager.isMainProcess ?
    "Parent ProcEnv" : "Child ProcEnv";

// create a new Environment
let ProcessEnvironment = new Environment(envName);


// set whether this is the main process
ProcessEnvironment.isMainProcess = EnvironmentManager.isMainProcess;
