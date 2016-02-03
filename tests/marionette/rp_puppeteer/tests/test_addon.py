# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.addon import Addon


class TestAddon(RequestPolicyTestCase):

    def setUp(self):
        super(TestAddon, self).setUp()
        self.addon = Addon(lambda: self.marionette,
                           addon_id="dummy-ext@requestpolicy.org",
                           install_url="http://localhost/.dist/dummy-ext.xpi")
        self.addon.install()

    def tearDown(self):
        try:
            self.addon.uninstall()
        finally:
            super(TestAddon, self).tearDown()

    def test_uninstall_install(self):
        self.assertTrue(self.addon.is_installed)
        self.addon.uninstall()
        self.assertFalse(self.addon.is_installed)
        self.addon.install()
        self.assertTrue(self.addon.is_installed)

    def test_multiple_uninstall_install(self):
        self.addon.uninstall()
        self.addon.uninstall()
        self.addon.install()
        self.addon.install()

    def test_disable_enable(self):
        self.assertTrue(self.addon.is_active)
        self.addon.disable()
        self.assertFalse(self.addon.is_active)
        self.addon.enable()
        self.assertTrue(self.addon.is_active)

    def test_multiple_disable_enable(self):
        self.addon.disable()
        self.addon.disable()
        self.addon.enable()
        self.addon.enable()

    def test_tmp_disabled(self):
        self.assertTrue(self.addon.is_active)
        with self.addon.tmp_disabled():
            self.assertFalse(self.addon.is_active)
        self.assertTrue(self.addon.is_active)

    def test_is_installed(self):
        self.assertTrue(self.addon.is_installed)
        self.addon.disable()
        self.assertTrue(self.addon.is_installed)
        self.addon.uninstall()
        self.assertFalse(self.addon.is_installed)
        self.addon.install()
        self.assertTrue(self.addon.is_installed)
        self.addon.enable()

    def test_is_active(self):
        self.assertTrue(self.addon.is_active)
        self.addon.disable()
        self.assertFalse(self.addon.is_active)
        self.addon.uninstall()
        self.assertFalse(self.addon.is_active)
        self.addon.install()
        self.addon.enable()
        self.assertTrue(self.addon.is_active)
