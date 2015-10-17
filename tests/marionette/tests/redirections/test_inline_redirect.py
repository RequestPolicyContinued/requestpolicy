# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
import time


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestInlineRedirect(RequestPolicyTestCase):

    def setUp(self):
        super(TestInlineRedirect, self).setUp()

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestInlineRedirect, self).tearDown()

    def test_redirect_notification_doesnt_appear(self):
        """This test ensures that the redirect notification is _not_ shown
        when the URL of an inline element, such as <img>, causes a redirection.
        """

        def test_no_appear(path):
            test_url = "http://www.maindomain.test/" + path

            with self.marionette.using_context("content"):
                self.marionette.navigate(test_url)

            # Wait some time to be sure the test is not faster than the
            # redirect notification.
            # FIXME: Find a better solution than `sleep()`
            time.sleep(0.1)

            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification.")

        test_no_appear("redirect-inline-image.html")
        test_no_appear("redirect-iframe.html")

