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

import * as sinonStatic from "sinon";
import * as SinonChrome from "sinon-chrome";
import {createBrowserApi} from "../lib/sinon-chrome";

import { Log } from "lib/classes/log";
import { PrefetchSettingsMerger } from "app/migration/merge-prefetch-settings";

describe("StorageMigration:", function() {
  const sinon = sinonStatic.createSandbox();

  let browserApi: typeof SinonChrome;
  let stubbedStorageArea: SinonChrome.storage.StubbedStorageArea;
  let log: Log;

  before(function() {
    browserApi = createBrowserApi();
    log = new Log();
  });

  beforeEach(function() {
    // MUST be in beforeEach (due to browserApi.flush() in afterEach):
    stubbedStorageArea = browserApi.storage.local;
  })

  afterEach(function() {
    browserApi.flush();
    sinon.reset();
  });

  describe("PrefetchSettingsMerger:", function() {
    let merger: PrefetchSettingsMerger;

    beforeEach(function() {
      merger = new PrefetchSettingsMerger(log, stubbedStorageArea)
    })

    describe("should set the target setting to if all source settings are equal", function() {
      it("(value 'true')", testForValue(true));
      it("(value 'false')", testForValue(false));

      function testForValue(value: boolean) {
        return async function() {
          // setup
          stubbedStorageArea.get.resolves({
            "prefetch.link.disableOnStartup": true,
            "prefetch.dns.disableOnStartup": true,
            "prefetch.preconnections.disableOnStartup": true,
          });
          stubbedStorageArea.set.resolves();
          stubbedStorageArea.remove.resolves();

          // exercise
          await merger.performAction();

          // verify
          stubbedStorageArea.remove.calledWithMatch([
            "prefetch.link.disableOnStartup",
            "prefetch.dns.disableOnStartup",
            "prefetch.preconnections.disableOnStartup",
          ]);
          stubbedStorageArea.set.calledWithMatch({
            "browserSettings.disableNetworkPrediction": true,
          });
        };
      }
    });

    it("should do nothing if none of the source settings exists", async function() {
      // setup
      stubbedStorageArea.get.resolves({});
      stubbedStorageArea.set.resolves();
      stubbedStorageArea.remove.resolves();

      // exercise
      await merger.performAction();

      // verify
      sinon.assert.notCalled(stubbedStorageArea.remove);
      sinon.assert.notCalled(stubbedStorageArea.set);
    });

    describe("should not overwrite existing target setting", function() {
      it("(target value 'true')", testForTargetValue(true));
      it("(target value 'false')", testForTargetValue(false));

      function testForTargetValue(value: boolean) {
        return async function() {
          // setup
          stubbedStorageArea.get.resolves({
            "prefetch.link.disableOnStartup": false,
            "prefetch.dns.disableOnStartup": false,
            "prefetch.preconnections.disableOnStartup": false,
            "browserSettings.disableNetworkPrediction": true,
          });

          // exercise
          await merger.performAction();

          // verify
          stubbedStorageArea.remove.calledWithMatch([
            "prefetch.link.disableOnStartup",
            "prefetch.dns.disableOnStartup",
            "prefetch.preconnections.disableOnStartup",
          ]);
          sinon.assert.notCalled(stubbedStorageArea.set);
        };
      }
    });
  });
});
