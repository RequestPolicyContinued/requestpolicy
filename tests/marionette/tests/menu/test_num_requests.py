# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class TestTotalNumRequestsAfterReload(RequestPolicyTestCase):

    TEST_URL = "http://www.maindomain.test/img_1.html";

    def setUp(self):
        super(TestTotalNumRequestsAfterReload, self).setUp()
        self.locationbar = self.browser.navbar.locationbar

    ################
    # Test Methods #
    ################

    def test_using_navigate(self):
        self._test(lambda url: self._navigate(url))

    def test_using_locationbar(self):
        self._test(lambda url: self.locationbar.load_url(url))

    def test_using_reload_button(self):
        self._test(lambda _: self.locationbar.reload_url(trigger="button"))

    def test_using_reload_shortcut(self):
        # CTRL + R
        self._test(lambda _: self.locationbar.reload_url(trigger="shortcut"))

    def test_using_reload_shortcut2(self):
        # F5
        self._test(lambda _: self.locationbar.reload_url(trigger="shortcut2"))

    ##########################
    # Private Helper Methods #
    ##########################

    def _test(self, reload_url):
        self._navigate(self.TEST_URL)
        n_before = self._get_num_requests()
        reload_url(self.TEST_URL)
        n_after = self._get_num_requests()
        # Sometimes (probably on every first page load) `shouldLoad` is
        # called twice for each request, so assert "GreaterEqual" instead
        # of just "Equal".
        self.assertGreaterEqual(n_before, n_after)

    def _get_num_requests(self):
        self.menu.open()
        num_requests = self.menu.total_num_requests
        self.menu.close()
        return num_requests

    def _navigate(self, url):
        with self.marionette.using_context("content"):
            self.marionette.navigate(url)
