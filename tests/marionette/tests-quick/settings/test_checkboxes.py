# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils
from functools import partial


RP_BRANCH = "extensions.requestpolicy."


class TestCheckboxes(RequestPolicyTestCase):

    def setUp(self):
        super(TestCheckboxes, self).setUp()

        app_version = AppInfo(lambda: self.marionette).version
        utils = Utils(lambda: self.marionette)
        self.fx_older_than_v49 = utils.compare_version(app_version, "49") < 0

    ################
    # Test Methods #
    ################

    def test_basicprefs(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:requestpolicy?basicprefs")

        self._test("pref-indicateBlockedObjects",
                   RP_BRANCH + "indicateBlockedObjects")

        with self.prefs.using_pref(RP_BRANCH + "indicateBlockedObjects", True):
            self._test("pref-dontIndicateBlacklistedObjects",
                       RP_BRANCH + "indicateBlacklistedObjects",
                       inverse=True)

        self._test("pref-autoReload", RP_BRANCH + "autoReload")

        self._test("pref-privateBrowsingPermanentWhitelisting",
                   RP_BRANCH + "privateBrowsingPermanentWhitelisting")

    def test_advancedprefs(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:requestpolicy?advancedprefs")

        self._test("pref-linkPrefetch", "network.prefetch-next")
        self._test("pref-prefetch.link.disableOnStartup",
                   RP_BRANCH + "prefetch.link.disableOnStartup")
        self._test("pref-prefetch.link.restoreDefaultOnUninstall",
                   RP_BRANCH + "prefetch.link.restoreDefaultOnUninstall")

        self._test("pref-dnsPrefetch", "network.dns.disablePrefetch",
                   inverse=True)
        self._test("pref-prefetch.dns.disableOnStartup",
                   RP_BRANCH + "prefetch.dns.disableOnStartup")
        self._test("pref-prefetch.dns.restoreDefaultOnUninstall",
                   RP_BRANCH + "prefetch.dns.restoreDefaultOnUninstall")

        self._test(
            "pref-speculativePreConnections",
            self._preconnect_pref("network.http.speculative-parallel-limit"))
        self._test(
            "pref-prefetch.preconnections.disableOnStartup",
            RP_BRANCH + "prefetch.preconnections.disableOnStartup")
        self._test(
            "pref-prefetch.preconnections.restoreDefaultOnUninstall",
            RP_BRANCH + "prefetch.preconnections.restoreDefaultOnUninstall")

        self._test("menu.info.showNumRequests",
                   RP_BRANCH + "menu.info.showNumRequests")

    def test_defaultpolicy(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:requestpolicy?defaultpolicy")

        with self.prefs.using_pref(RP_BRANCH + "defaultPolicy.allow", False):
            self._test("allowsamedomain",
                       RP_BRANCH + "defaultPolicy.allowSameDomain")

        self._test("allowtoplevel",
                   RP_BRANCH + "defaultPolicy.allowTopLevel")

    ##########################
    # Private Helper Methods #
    ##########################

    def _test(self, checkbox_id, pref, inverse=False):
        if isinstance(pref, str):
            pref = self._pref(pref)

        with self.marionette.using_context("content"):
            checkbox = self.marionette.find_element("id", checkbox_id)
            compare = partial(self._compare, checkbox, pref, inverse=inverse)

            initial_value = pref["get"]()

            compare(initial_value)
            checkbox.click()
            compare(not initial_value)
            checkbox.click()
            compare(initial_value)

            self._toggle_pref(pref)
            compare(not initial_value)
            self._toggle_pref(pref)
            compare(initial_value)

    def _compare(self, checkbox, pref, expected_pref_value, inverse=False):
        if self.fx_older_than_v49:
            # up to Firefox 48 (Bug 1272653)
            cb_value = checkbox.get_attribute("checked") == "true"
        else:
            cb_value = checkbox.get_property("checked")
        pref_value = pref["get"]()

        try:
            self.assertIsInstance(cb_value, bool)
            self.assertIsInstance(pref_value, bool)

            self.assertEqual(expected_pref_value, pref_value)

            if not inverse:
                self.assertEqual(cb_value, pref_value)
            else:
                self.assertNotEqual(cb_value, pref_value)
        except:
            print ("pref name: {}, checkbox: {}, pref: {}"
                   .format(pref["name"], str(cb_value), str(pref_value)))
            raise

    def _toggle_pref(self, pref):
        current_value = pref["get"]()
        pref["set"](not current_value)

    def _pref(self, pref_name):
        return {
            "name": pref_name,
            "get": lambda: self.prefs.get_pref(pref_name),
            "set": lambda v: self.prefs.set_pref(pref_name, v)
        }

    def _preconnect_pref(self, pref_name):
        def value():
            return self.prefs.get_pref(pref_name)
        return {
            "name": pref_name,
            "get": lambda: False if value() == 0 else True,
            "set": lambda v: self.prefs.set_pref(pref_name,
                                                 0 if v is False else 6)
        }
