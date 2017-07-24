# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette_driver.marionette import Actions


TEST_URL = "http://www.maindomain.test/link_1.html";
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestOpenInNewTab(RequestPolicyTestCase):
    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False);

    def test_open_in_new_tab(self):
        with self.marionette.using_context("content"):
            # load the test url
            self.marionette.navigate(TEST_URL)
            # get the link and its url
            link = self.marionette.find_element("tag name", "a")
            link_url = link.get_attribute("href")

        with self.marionette.using_context("chrome"):
            # Open the link in a new tab, using all possible methods
            # sequentially.
            for _ in self.open_link_multi(link):
                self.assertEqual(len(self.browser.tabbar.tabs), 2,
                                 "A new tab has been opened.")

                [origin_tab, dest_tab] = self.browser.tabbar.tabs
                self.tabs.wait_until_loaded(dest_tab)

                # checks in the origin's tab
                origin_tab.switch_to()
                self.assertFalse(self.redir.is_shown(),
                                 ("Following the link didn't cause a "
                                  "redirect in the origin tab."))

                # checks in the destination's tab
                dest_tab.switch_to()
                self.assertEqual(dest_tab.location, link_url,
                                 "The location in the new tab is correct.")
                self.assertFalse(self.redir.is_shown(),
                                 ("Following the link didn't cause a "
                                  "redirect in the destination tab."))

                dest_tab.close()

    def open_link_multi(self, link):
        """Open a link in new tabs using different methods."""

        # METHOD #1: middle click
        with self.marionette.using_context("content"):
            Actions(self.marionette).click(link, 1).perform()
        yield

        # METHOD #2: context menu
        self.ctx_menu.select_entry("context-openlinkintab", link)
        # TODO: Use the "tabs" library as soon as it has been ported
        #       to Marionette, see Mozilla Bug 1121725.
        #       The mozmill code to open the link in a new tab was:
        #       ```
        #       tabBrowser.openTab({method: "contextMenu", target: link});
        #       ```
        yield
