# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.addon import Addon
import os


class TestWebExtension(RequestPolicyTestCase):

    def setUp(self):
        super(TestWebExtension, self).setUp()
        self.addon = Addon(
            lambda: self.marionette,
            addon_id="apply-css@mozilla.org",
            install_url=("file://{}/dist/webext-apply-css.xpi"
                         .format(os.getcwd()))
        )

    def tearDown(self):
        try:
            self.addon.uninstall()
        finally:
            super(TestWebExtension, self).tearDown()

    def test_install(self):
        self.assertFalse(self.addon.is_installed)
        self.requests.start_listening()
        self.addon.install()
        self.requests.stop_listening()
        self.assertTrue(self.addon.is_installed)
        for request in self.requests.all:
            if (request["dest"].startswith("moz-extension://") and
                not request["isAllowed"]):
                self.fail("A moz-extension request has been blocked.")
