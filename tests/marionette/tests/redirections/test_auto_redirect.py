# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette_driver.errors import TimeoutException
from marionette import SkipTest
from rp_ui_harness.utils import redirections


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestAutoRedirect(RequestPolicyTestCase):

    def setUp(self):
        super(TestAutoRedirect, self).setUp()

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestAutoRedirect, self).tearDown()

    ################
    # Test Methods #
    ################

    def test_redirect_notification_appears_or_not(self):
        """Using some pages which cause redirections, this test ensures
        that the redirect notification appears when it's expected and stays
        hidden when it's not expected.
        """

        def test_no_appear((test_url, dest_url), info):
            with self.marionette.using_context("content"):
                self.marionette.navigate(test_url)

            # The page might redirect with a delay. There shouldn't be the
            # notification neither before nor after the redirection.
            self._assert_redir_is_shown(test_url, dest_url, is_shown=False)
            redirections.wait_until_url_load(self, dest_url,
                                             "The location has changed.")
            self._assert_redir_is_shown(test_url, dest_url, is_shown=False)

        def test_appear((test_url, dest_url), info):
            self._load_about_blank()
            self._navigate_expecting_r21n(test_url)

            self._assert_redir_is_shown(test_url, dest_url, is_shown=True)
            redirections.assert_url_does_not_load(
                self, dest_url,
                expected_delay=info["delay"])

            self.redir.close()

        def test(uris, info):
            if info["is_same_host"]:
                test_no_appear(uris, info)
            else:
                test_appear(uris, info)

        redirections.for_each_possible_redirection_scenario(test, "auto")

    def test_allow(self):
        def test((test_url, dest_url), info):
            if info["is_same_host"]:
                # the notification won't appear
                return

            self._navigate_expecting_r21n(test_url)
            self._assert_redir_is_shown(test_url, dest_url, is_shown=True)
            self.redir.allow()
            self._assert_redir_is_shown(test_url, dest_url, is_shown=False)
            with self.marionette.using_context("content"):
                self.assertEqual(self.marionette.get_url(), dest_url)

        redirections.for_each_possible_redirection_scenario(test, "auto")

    def test_r21n_appears_again_after_allow(self):
        raise SkipTest("Skipping due to issue #726.")

        def test((test_url, dest_url), info):
            if info["is_same_host"]:
                # the notification won't appear
                return

            self._load_about_blank()
            self._navigate_expecting_r21n(test_url)
            self._assert_redir_is_shown(test_url, dest_url, is_shown=True)
            redirections.assert_url_does_not_load(
                self, dest_url,
                expected_delay=info["delay"])
            self.redir.allow()

            self._load_about_blank()
            self._navigate_expecting_r21n(test_url)
            self._assert_redir_is_shown(test_url, dest_url, is_shown=True)
            redirections.assert_url_does_not_load(
                self, dest_url,
                expected_delay=info["delay"])
            self.redir.close()

        redirections.for_each_possible_redirection_scenario(test, "auto")

    ##########################
    # Private Helper Methods #
    ##########################

    def _assert_redir_is_shown(self, test_url, dest_url, is_shown):
        redirections.assert_redir_is_shown(
            self, test_url, dest_url, is_shown)

    def _navigate_expecting_r21n(self, url):
        """Navigate to a URL, catching all expected exceptions."""

        if self.browser_info.e10s_enabled:
            # On E10s there's no TimeoutException raised.

            # In case of HTTP header redirections `marionette.navigate()`
            # raises an IOError. The workaround is to use the location-bar
            # instead.
            # For details see Mozilla Bug 1219969 / Issue #727.
            self.browser.navbar.locationbar.load_url(url)
            self.tabs.wait_until_loaded(self.browser.tabbar.tabs[0])
        else:
            with self.marionette.using_context("content"):
                # On non-E10s, expect a TimeoutException, because when
                # RequestPolicy blocks a redirection, the page never loads.

                # Set the timeout to a low value in order to speed up the
                # test.
                self.marionette.timeouts("page load", 100)  # seconds
                # The following code can be used when Bug 1316622 lands:
                # original_page_load_timeout = (
                #     self.marionette.timeout.page_load)
                # self.marionette.timeout.page_load = 0.1  # miliseconds

                self.assertRaises(TimeoutException, self.marionette.navigate,
                                  url)

                self.marionette.timeouts("page load", 20000)
                # self.marionette.timeout.page_load = (
                #     original_page_load_timeout)

    def _get_url(self):
        with self.marionette.using_context("content"):
            return self.marionette.get_url()

    def _load_about_blank(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:blank")
