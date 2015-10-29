# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


PRE_PATH = "http://www.maindomain.test/"
PAGE_WITH_REDIRECT = PRE_PATH + "redirect-meta-tag-01-immediate.html"
PAGE_WITH_REDIRECT__DEST = ("http://www.otherdomain.test/destination.html?"
                            "redirect-meta-tag-01%20redirected%20here.")
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestRedirectNotification(RequestPolicyTestCase):

    def setUp(self):
        super(TestRedirectNotification, self).setUp()

        self.marionette.set_pref(PREF_DEFAULT_ALLOW, False)

    def tearDown(self):
        try:
            if self.redir.is_shown():
                self.redir.close()
        finally:
            super(TestRedirectNotification, self).tearDown()

    def test_allow(self):
        with self.marionette.using_context("content"):
            # FIXME: Remove the "?..." part when #726 is fixed.
            self.marionette.navigate(PAGE_WITH_REDIRECT + "?test_allow")

        self.assertTrue(self.redir.is_shown())
        self.redir.allow()

        with self.marionette.using_context("content"):
            self.assertEqual(self.marionette.get_url(),
                             PAGE_WITH_REDIRECT__DEST)
        self.assertFalse(self.redir.is_shown())

    def test_close(self):
        with self.marionette.using_context("content"):
            # FIXME: Remove the "?..." part when #726 is fixed.
            self.marionette.navigate(PAGE_WITH_REDIRECT + "?test_close")

        self.assertTrue(self.redir.is_shown())
        self.redir.close()
        # The panel should be closed when `close()` has been called,
        # that is, the close action should be synchronized.
        self.assertFalse(self.redir.is_shown())
