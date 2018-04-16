# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette.marionette_test import SkipTest
import time

PREF_WELCOME_WIN_SHOWN = "extensions.requestpolicy.welcomeWindowShown"


class CommonTests:
    class TestRequestPolicyRestartlessness(RequestPolicyTestCase):
        """These tests ensure that RequestPolicy can be uninstalled/installed
        and disabled/enabled restartless.
        """

        def test_disable_enable(self):
            self.assertTrue(
                self.rp_addon.is_active,
                msg="The addon is enabled.")
            self.rp_addon.disable()
            self.assertFalse(self.rp_addon.is_active,
                             msg="The addon has been disabled.")
            self.rp_addon.enable()
            self.assertTrue(self.rp_addon.is_active,
                            msg="The addon has been re-enabled.")

        def test_uninstall_install(self):
            # remove:
            self.assertTrue(self.rp_addon.is_installed,
                            msg="The addon is installed.")
            self.rp_addon.uninstall()
            self.assertFalse(self.rp_addon.is_installed,
                             msg="The addon has been removed.")

            # re-install:
            self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, True)
            self.rp_addon.install()
            self.assertTrue(self.rp_addon.is_installed,
                            msg="The addon has been re-installed.")


class TestNormal(CommonTests.TestRequestPolicyRestartlessness):
    def setUp(self):
        super(TestNormal, self).setUp()
        # Wait some time in order to ensure the browser is in idle.
        time.sleep(0.2)


class TestAfterNavigate(CommonTests.TestRequestPolicyRestartlessness):
    def setUp(self):
        super(TestAfterNavigate, self).setUp()

        raise SkipTest("Skipping due to issue #728.")

        with self.marionette.using_context("content"):
            self.marionette.navigate("http://localhost/")
