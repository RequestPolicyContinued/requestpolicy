/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

"use strict";

import {assert} from "chai";
import * as sinonStatic from "sinon";
import * as SinonChrome from "sinon-chrome";
import {createBrowserApi} from "../lib/sinon-chrome";

import { AsyncSettings } from "app/storage/async-settings";
import { Log } from "lib/classes/log";
import { defer } from "lib/utils/js-utils";
import { StorageApiWrapper } from "app/storage/storage-api-wrapper";
import { Module } from "lib/classes/module";

type IStorageChanges = browser.storage.ChangeDict;

describe("AsyncSettings", function() {
  const sinon = sinonStatic.createSandbox();

  let browserApi: typeof SinonChrome;
  let stubbedStorage: typeof SinonChrome.storage;
  let stubbedStorageArea: SinonChrome.storage.StubbedStorageArea;
  let log: Log;
  let asyncSettings: AsyncSettings;

  function createAsyncSettings(
      defaultSettings = {},
      storageReadyPromise = Promise.resolve(),
  ) {
    const storageAvailabilityController = new Module("", log);
    storageReadyPromise.then(() => storageAvailabilityController.startup());
    const storageApiWrapper = new StorageApiWrapper(
        null, log, stubbedStorage, storageAvailabilityController as any,
    );
    storageApiWrapper.startup();
    return new AsyncSettings(
        log,
        null,
        storageApiWrapper,
        defaultSettings,
    );
  }

  before(function() {
    browserApi = createBrowserApi();
    log = new Log();
  });

  beforeEach(function() {
    // MUST be in beforeEach (due to browserApi.flush() in afterEach):
    stubbedStorage = browserApi.storage;
    stubbedStorageArea = stubbedStorage.local;
  });

  afterEach(function() {
    browserApi.flush();
    sinon.reset();
  });

  describe(".get()", function() {
    it("should throw for a pref without a default", async function() {
      // setup
      stubbedStorageArea.get.resolves({});
      asyncSettings = createAsyncSettings();
      asyncSettings.startup();
      await asyncSettings.whenReady;

      // exercise + verify
      assert.throws(() => asyncSettings.get("foo"));
    });

    it("should return the default if no value is set", async function() {
      // setup
      stubbedStorageArea.get.resolves({
        foo: "bar",
      });
      asyncSettings = createAsyncSettings({
        foo: "bar",
      });
      asyncSettings.startup();
      await asyncSettings.whenReady;

      // exercise
      const result = await asyncSettings.get("foo");

      // verify
      sinon.assert.callCount(stubbedStorageArea.get, 1);
      sinon.assert.calledWithMatch(stubbedStorageArea.get, {foo: "bar"});
      assert.deepEqual(result, {foo: "bar"});
    });

    it("should return the stored value for a pref with both a default and a value", async function() {
      // setup
      stubbedStorageArea.get.resolves({
        foo: "BAZ",
      });
      asyncSettings = createAsyncSettings({
        foo: "baz",
      });
      asyncSettings.startup();
      await asyncSettings.whenReady;

      // exercise
      const result = await asyncSettings.get("foo");

      // verify
      sinon.assert.callCount(stubbedStorageArea.get, 1);
      sinon.assert.calledWithMatch(stubbedStorageArea.get, {foo: "baz"});
      assert.deepEqual(result, {foo: "BAZ"});
    });
  });

  describe(".onChanged", function() {
    it("should ignore prefs without a default value", async function() {
      // setup
      asyncSettings = createAsyncSettings();
      const dChanges = defer<IStorageChanges>();
      const changeListener = sinon.spy((changes) => {
        dChanges.resolve(changes);
      });
      asyncSettings.onChanged.addListener(changeListener);
      asyncSettings.startup();
      await asyncSettings.whenReady;
      stubbedStorage.local.set.resolves();

      // exercise
      stubbedStorage.onChanged.trigger({foo: {newValue: "bar"}});

      // verify
      sinon.assert.notCalled(changeListener);
    });

    it("should use the default value if removed", async function() {
      // setup
      asyncSettings = createAsyncSettings({
        foo: "DEFAULT",
      });
      const dChanges = defer<IStorageChanges>();
      const changeListener = sinon.spy((changes) => {
        dChanges.resolve(changes);
      });
      asyncSettings.onChanged.addListener(changeListener);
      asyncSettings.startup();
      await asyncSettings.whenReady;
      stubbedStorage.local.set.resolves()

      // exercise
      stubbedStorage.onChanged.trigger({foo: {}});
      const changes = await dChanges.promise;

      // verify
      assert.deepEqual(changes, {foo: {newValue: "DEFAULT"}});
    });

    it("should not overwrite 'newValue'", async function() {
      // setup
      asyncSettings = createAsyncSettings({
        foo: "DEFAULT",
      });
      const dChanges = defer<IStorageChanges>();
      const changeListener = sinon.spy((changes) => {
        dChanges.resolve(changes);
      });
      asyncSettings.onChanged.addListener(changeListener);
      asyncSettings.startup();
      await asyncSettings.whenReady;
      stubbedStorage.local.set.resolves();

      // exercise
      stubbedStorage.onChanged.trigger({foo: {newValue: "myNewValue"}});
      const changes = await dChanges.promise;

      // verify
      assert.deepEqual(changes, {foo: {newValue: "myNewValue"}});
    });

    it("should ignore effective non-changes (removals)", async function() {
      // setup
      asyncSettings = createAsyncSettings({
        foo: "oldValueAndDefault",
      });
      const dChanges = defer<IStorageChanges>();
      const changeListener = sinon.spy((changes) => {
        dChanges.resolve(changes);
      });
      asyncSettings.onChanged.addListener(changeListener);
      asyncSettings.startup();
      await asyncSettings.whenReady;
      stubbedStorage.local.set.resolves();

      // exercise
      stubbedStorage.onChanged.trigger({foo: {oldValue: "oldValueAndDefault"}});

      // verify
      sinon.assert.notCalled(changeListener);
    });

    it("should work with multiple concurrent changes", async function() {
      // setup
      asyncSettings = createAsyncSettings({
        applyDefault: "DEFAULT:applyDefault",
        applyUserValue: "DEFAULT:applyUserValue",
        effectivelyUnchanged: "oldValueAndDefault",
      });
      const dChanges = defer<IStorageChanges>();
      const changeListener = sinon.spy((changes) => {
        dChanges.resolve(changes);
      });
      asyncSettings.onChanged.addListener(changeListener);
      asyncSettings.startup();
      await asyncSettings.whenReady;
      stubbedStorage.local.set.resolves();

      // exercise
      stubbedStorage.onChanged.trigger({
        applyDefault: {},
        applyUserValue: {newValue: "myNewUserValue"},
        effectivelyUnchanged: {oldValue: "oldValueAndDefault"},
        settingWithoutDefaultValue: {newValue: "something"},
      });
      const changes = await dChanges.promise;

      // verify
      assert.deepEqual(changes, {
        applyDefault: {newValue: "DEFAULT:applyDefault"},
        applyUserValue: {newValue: "myNewUserValue"},
      });
    });
  });
});
