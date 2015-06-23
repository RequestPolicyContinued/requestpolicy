# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.ui.addons import RequestPolicy

PREF_WELCOME_WIN_SHOWN = "extensions.requestpolicy.welcomeWindowShown"


class TestRequestPolicyRestartlessness(RequestPolicyTestCase):
    """These tests ensure that RequestPolicy can be uninstalled/installed and
    disabled/enabled restartless.
    """

    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.rp = RequestPolicy(lambda: self.marionette)

    def test_disable_enable(self):
        self.assertTrue(self.rp.is_enabled(), msg="The addon is enabled.")
        self.rp.disable()
        self.assertFalse(self.rp.is_enabled(),
                         msg="The addon has been disabled.")
        self.rp.enable()
        self.assertTrue(self.rp.is_enabled(),
                        msg="The addon has been re-enabled.")

    def test_uninstall_install(self):
        # remove:
        self.assertTrue(self.rp.is_installed(), msg="The addon is installed.")
        self.rp.remove()
        self.assertFalse(self.rp.is_installed(),
                         msg="The addon has been removed.")

        # re-install:
        self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, True)
        self.rp.install()
        self.assertTrue(self.rp.is_installed(),
                        msg="The addon has been re-installed.")
