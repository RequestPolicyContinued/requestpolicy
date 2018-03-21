/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2014 Martin Kimmerle
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

/* global RUN_ID */ // see bootstrap.jsm

const env = (str) => str[0] !== "undefined";

export const C = {
  LOG_ENVIRONMENT: env`/* @echo LOG_ENVIRONMENT */`,
  LOG_EVENT_LISTENERS: env`/* @echo LOG_EVENT_LISTENERS */`,
  LOG_FLAG_STATE: env`/* @echo LOG_FLAG_STATE */`,
  LOG_GETTING_SAVED_REQUESTS: env`/* @echo LOG_GETTING_SAVED_REQUESTS */`,
  LOG_MESSAGE_LISTENERS: env`/* @echo LOG_MESSAGE_LISTENERS */`,
  LOG_REQUESTS: env`/* @echo LOG_REQUESTS */`,

  AMO: env`/* @echo AMO */`,
  BUILD_ALIAS: `/* @echo BUILD_ALIAS */`,

  get UI_TESTING() {
    return this.BUILD_ALIAS === "ui-testing";
  },

  LOG_PREFIX: "[RequestPolicy] ",

  EXTENSION_ID: "/* @echo EXTENSION_ID */",

  // NOTE: do not generate the run ID here,
  //   because "constants.js" gets loaded multiple times, i.e.,
  //   in multiple environments.
  CONTEXT_ID: Math.random(),
  get RUN_ID() {
    return RUN_ID;
  },

  FIREFOX_ID: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  SEAMONKEY_ID: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}",
  // We need a random RUN_ID because of https://bugzilla.mozilla.org/show_bug.cgi?id=1202125
  get MMID() { // message manager ID
    return `${this.EXTENSION_ID}_${this.RUN_ID}`;
  },
  get MM_PREFIX() {
    return `${this.MMID}:`;
  },

  RULE_ACTION_ALLOW: 1,
  RULE_ACTION_DENY: 2,

  UNDEFINED: Symbol("UNDEFINED"),
};
