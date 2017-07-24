# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils


class TestImagePlaceholder(RequestPolicyTestCase):

    def setUp(self):
        super(TestImagePlaceholder, self).setUp()

        app_version = AppInfo(lambda: self.marionette).version
        utils = Utils(lambda: self.marionette)
        self.fx_older_than_v49 = utils.compare_version(app_version, "49") < 0

    ################
    # Test Methods #
    ################

    def test_normal(self):
        self._test("http://www.maindomain.test/img_1.html")

    def test_fragment(self):
        with self.marionette.using_context("content"):
            # First load a blank page to ensure the URL is not
            # "http://www.maindomain.test/img_1.html".
            self.marionette.navigate("about:blank")
        self._test("http://www.maindomain.test/img_1.html#fragment-part")

    ##########################
    # Private Helper Methods #
    ##########################

    def _test(self, test_url):
        with self.marionette.using_context("content"):
            self.marionette.navigate(test_url)
            image = self.marionette.find_element("id", "cross-site-image")
            if self.fx_older_than_v49:
                # up to Firefox 48 (Bug 1272653)
                self.assertTrue(image.get_attribute("rpcontinuedIdentified"))
            else:
                self.assertTrue(image.get_property("rpcontinuedIdentified"))
