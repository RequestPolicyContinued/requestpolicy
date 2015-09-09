# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.ui.redirect_notification import RedirectNotification


TEST_URL = "http://www.maindomain.test/link_1.html";
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClick(RequestPolicyTestCase):
    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False);
        self.redir = RedirectNotification(lambda: self.marionette)


    def test_link_click(self):
        with self.marionette.using_context("content"):
            # load the test url
            self.marionette.navigate(TEST_URL)
            # get the link, its url, and click the link
            link = self.marionette.find_element("tag name", "a")
            link_url = link.get_attribute("href")
            link.click()

        self.assertFalse(self.redir.panel_exists(),
                         "Following the link didn't cause a redirect.")
        self.assertEqual(self.browser.tabbar.selected_tab.location,
                         link_url, "The location is correct.")
