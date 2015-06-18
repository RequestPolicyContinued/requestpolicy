# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness import FirefoxTestCase
from rp_puppeteer.ui.addons import Addons

PREF_WELCOME_WIN_SHOWN = "extensions.requestpolicy.welcomeWindowShown"
RP_ID = "rpcontinued@non-amo.requestpolicy.org"
INSTALL_URL = "http://localhost/link.html?.dist/requestpolicy-unit-testing.xpi"


class TestRequestPolicyRestartlessness(FirefoxTestCase):
    """These tests ensure that RequestPolicy can be uninstalled/installed and
    disabled/enabled restartless.
    """

    def setUp(self):
        FirefoxTestCase.setUp(self)
        self.addons = Addons(lambda: self.marionette)

    def test_disable_enable(self):
        with self.addons.using_addon_list() as about_addons:
            rp = about_addons.get_addon_by_id(RP_ID)

            self.assertTrue(rp.is_enabled(), msg="The addon is enabled.")
            about_addons.disable_addon(rp)
            self.assertFalse(rp.is_enabled(),
                             msg="The addon has been disabled.")
            about_addons.enable_addon(rp)
            self.assertTrue(rp.is_enabled(),
                            msg="The addon has been re-enabled.")

    def test_uninstall_install(self):
        with self.addons.using_addon_list() as about_addons:
            def is_rp_installed():
                return about_addons.is_addon_installed(RP_ID)

            # remove:
            self.assertTrue(is_rp_installed(), msg="The addon is installed.")
            about_addons.remove_addon(about_addons.get_addon_by_id(RP_ID))
            self.assertFalse(is_rp_installed(),
                             msg="The addon has been removed.")

            # re-install:
            self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, True)
            self.addons.install_addon(INSTALL_URL)
            self.assertTrue(is_rp_installed(),
                            msg="The addon has been re-installed.")
