# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClickRedirect(RequestPolicyTestCase):

    def setUp(self):
        super(TestLinkClickRedirect, self).setUp()

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestLinkClickRedirect, self).tearDown()

    def test_redirect_notification_appears_or_not(self):

        def test_no_appear(test_url):
            open_page_and_click_on_first_link(test_url)

            self.assertNotEqual(self.marionette.get_url(), test_url,
                                "The URL in the urlbar has changed.")
            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification.")

        def test_appear(test_url):
            open_page_and_click_on_first_link(test_url)

            self.assertTrue(self.redir.is_shown(),
                            "The redirect notification has been displayed.")

            self.redir.close()

        def open_page_and_click_on_first_link(test_url):
            with self.marionette.using_context("content"):
                self.marionette.navigate(test_url)
                link = self.marionette.find_element("tag name", "a")
                link.click()

        def get_url(path, generate_page_with_link=True):
            if generate_page_with_link:
                path = "link.html?" + path
            return "http://www.maindomain.test/" + path


        test_appear(get_url("redirect-js-document-location-link.html",
                            generate_page_with_link=False))

        test_appear(get_url("redirect-http-location-header.php"))
        test_appear(get_url("redirect-http-refresh-header.php"))
        test_appear(get_url("redirect-js-document-location-auto.html"))
        test_appear(get_url("redirect-meta-tag-01-immediate.html"))
        test_appear(get_url("redirect-meta-tag-02-delayed.html"))
        test_appear(get_url("redirect-meta-tag-03-multiple.html"))
        test_appear(get_url("redirect-meta-tag-08.html"))

        test_no_appear(get_url("redirect-meta-tag-04-relative-without-slash.html"))
        test_no_appear(get_url("redirect-meta-tag-05-relative-with-slash.html"))
        test_no_appear(get_url("redirect-meta-tag-06-different-formatting.html"))
        test_no_appear(get_url("redirect-meta-tag-07-different-formatting-delayed.html"))
        test_no_appear(get_url("redirect-meta-tag-09-relative.html"))
