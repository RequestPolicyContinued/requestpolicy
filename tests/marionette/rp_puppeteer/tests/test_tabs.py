# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette_driver.marionette import Actions
from rp_ui_harness import RequestPolicyTestCase


PRE_PATH = "http://www.maindomain.test/"


class TestTabs(RequestPolicyTestCase):

    def test_wait_until_loaded(self):
        test_url = "slowly_loading_page.php?load_duration=300"
        with self.marionette.using_context("content"):
            url_with_link = PRE_PATH + "link.html?" + test_url
            self.marionette.navigate(url_with_link)
            link = self.marionette.find_element("tag name", "a")

        # Open Link in New Tab (background).
        # Use middle click because the context menu does not always work.
        # (TimeoutException)
        with self.marionette.using_context("content"):
            Actions(self.marionette).click(link, 1).perform()
        # self.ctx_menu.select_entry("context-openlinkintab", link)

        tabbar = self.browser.tabbar
        new_tab = tabbar.tabs[1]
        self.assertIs(tabbar.selected_index, 0)

        # The action "Open Link in New Tab" above does _not_ include a
        # "wait for tab" action. Since the page's load should be much slower
        # than this test, the tab should be still loading at this point.
        self.assertFalse(self.tabs.is_loaded(new_tab))

        # FUNCTION UNDER TEST:
        self.tabs.wait_until_loaded(new_tab)
        self.assertTrue(self.tabs.is_loaded(new_tab),
                        "The tab should now be loaded.")
        self.assertEqual(new_tab.location, PRE_PATH + test_url)

        new_tab.close()
