# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from functools import partial


RP_BRANCH = "extensions.requestpolicy."


class TestCheckboxes(RequestPolicyTestCase):

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

        self._test("menu.info.showNumRequests",
                   RP_BRANCH + "menu.info.showNumRequests")

    def test_defaultpolicy(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:requestpolicy?defaultpolicy")

        with self.prefs.using_pref(RP_BRANCH + "defaultPolicy.allow", False):
            self._test("allowsamedomain",
                       RP_BRANCH + "defaultPolicy.allowSameDomain")

    ##########################
    # Private Helper Methods #
    ##########################

    def _test(self, checkbox_id, pref_name, inverse=False):
        with self.marionette.using_context("content"):
            checkbox = self.marionette.find_element("id", checkbox_id)
            compare = partial(self._compare, checkbox, pref_name,
                              inverse=inverse)

            initial_value = self.prefs.get_pref(pref_name)

            compare(initial_value)
            checkbox.click()
            compare(not initial_value)
            checkbox.click()
            compare(initial_value)

            self._toggle_pref(pref_name)
            compare(not initial_value)
            self._toggle_pref(pref_name)
            compare(initial_value)

    def _compare(self, checkbox, pref_name, expected_pref_value, inverse=False):
        cb_value = checkbox.get_attribute("checked") == "true"
        pref_value = self.prefs.get_pref(pref_name)

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
                   .format(pref_name, str(cb_value), str(pref_value)))
            raise

    def _toggle_pref(self, pref_name):
        current_value = self.prefs.get_pref(pref_name)
        self.prefs.set_pref(pref_name, not current_value)

