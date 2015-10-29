# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette_driver.errors import TimeoutException
from marionette import SkipTest


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

        def test_no_appear(path):
            test_url = "http://www.maindomain.test/" + path
            # FIXME: Remove the following line when #726 is fixed.
            test_url += "?test_redirect_notification_appears_or_not"

            with self.marionette.using_context("content"):
                self.marionette.navigate(test_url)

            self.assertNotEqual(self.marionette.get_url(), test_url,
                                "The URL in the urlbar has changed.")
            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification.")

        def test_appear(path):
            test_url = "http://www.maindomain.test/" + path
            # FIXME: Remove the following line when #726 is fixed.
            test_url += "?test_redirect_notification_appears_or_not"

            initial_uri = self.marionette.get_url()

            self._navigate_expecting_r21n(test_url)

            self.assertTrue(self.redir.is_shown(),
                            "The redirect notification has been displayed.")
            self.assertIn(self.marionette.get_url(), [test_url, initial_uri],
                          "The URL in the urlbar did not change.")

            self.redir.close()

        # FIXME: Issue #727;   On E10s, Marionette Tests for HTTP
        #        <location|refresh> header redirections raise IOError.
        if not self.browser_info.e10s_enabled:
            test_appear("redirect-http-location-header.php")
            test_appear("redirect-http-refresh-header.php")

        test_appear("redirect-js-document-location-auto.html")
        test_appear("redirect-meta-tag-01-immediate.html")
        test_appear("redirect-meta-tag-02-delayed.html")
        test_appear("redirect-meta-tag-03-multiple.html")
        test_appear("redirect-meta-tag-08.html")

        test_no_appear("redirect-meta-tag-04-relative-without-slash.html")
        test_no_appear("redirect-meta-tag-05-relative-with-slash.html")
        test_no_appear("redirect-meta-tag-06-different-formatting.html")
        test_no_appear("redirect-meta-tag-07-different-formatting-delayed.html")
        test_no_appear("redirect-meta-tag-09-relative.html")

    def test_allow(self):

        def test(path, dest_uri):
            test_url = "http://www.maindomain.test/" + path
            # FIXME: Remove the following line when #726 is fixed.
            test_url += "?test_allow"

            self._navigate_expecting_r21n(test_url)
            self.assertTrue(self.redir.is_shown())
            self.redir.allow()
            self.assertFalse(self.redir.is_shown())
            with self.marionette.using_context("content"):
                self.assertEqual(self.marionette.get_url(), dest_uri)

        # FIXME: Issue #727
        if not self.browser_info.e10s_enabled:
            # Header redirection
            test("redirect-http-location-header.php",
                 "http://www.otherdomain.test/")

        # JavaScript redirection
        test("redirect-js-document-location-auto.html",
             "http://www.otherdomain.test/")
        # <meta> redirection
        test("redirect-meta-tag-01-immediate.html",
             ("http://www.otherdomain.test/destination.html?"
              "redirect-meta-tag-01%20redirected%20here."))

    def test_r21n_appears_again_after_allow(self):
        raise SkipTest("Skipping due to issue #726.")

        def test(path):
            test_url = "http://www.maindomain.test/" + path

            self._navigate_expecting_r21n(test_url)
            self.assertTrue(self.redir.is_shown())
            self.redir.allow()

            self._navigate_expecting_r21n(test_url)
            self.assertTrue(self.redir.is_shown())
            self.redir.close()

        # FIXME: Issue #727
        if not self.browser_info.e10s_enabled:
            # Header redirection
            test("redirect-http-location-header.php")

        # JavaScript redirection
        test("redirect-js-document-location-auto.html")
        # <meta> redirection
        test("redirect-meta-tag-01-immediate.html")

    ##########################
    # Private Helper Methods #
    ##########################

    def _navigate_expecting_r21n(self, url):
        """Navigate to a URL, catching all expected exceptions."""

        with self.marionette.using_context("content"):
            if self.browser_info.e10s_enabled:
                # On E10s there's no TimeoutException raised.
                self.marionette.navigate(url)
            else:
                # On non-E10s, expect a TimeoutException, because when
                # RequestPolicy blocks a redirection, the page never loads.

                # Set the timeout to a low value in order to speed up the
                # test.
                self.marionette.timeouts("page load", 100)

                self.assertRaises(TimeoutException, self.marionette.navigate,
                                  url)

                self.marionette.timeouts("page load", 20000)
