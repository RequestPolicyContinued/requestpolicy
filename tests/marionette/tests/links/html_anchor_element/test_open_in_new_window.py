# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


TEST_URL = "http://www.maindomain.test/link_1.html";
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestOpenInNewWindow(RequestPolicyTestCase):
    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False);
        self.main_window = self.windows.current


    def tearDown(self):
        self.windows.close_all(exceptions=[self.main_window])
        RequestPolicyTestCase.tearDown(self)


    def test_open_in_new_window(self):
        with self.marionette.using_context("content"):
            # load the test url
            self.marionette.navigate(TEST_URL)
            # get the link and its url
            link = self.marionette.find_element("tag name", "a")
            link_url = link.get_attribute("href")

        with self.marionette.using_context("chrome"):
            self.assertEqual(len(self.windows.all), 1, "There is only one window.")

            # Open the link in a new tab, using all possible methods
            # sequentially.
            for _ in self.open_link_multi(link):
                self.assertEqual(len(self.windows.all), 2,
                                 "A new window has been opened.")

                new_window_handle = self.windows.focused_chrome_window_handle
                self.assertNotEqual(new_window_handle, self.main_window.handle,
                                    "The new window has been focused.")
                new_window = self.windows.create_window_instance(
                    new_window_handle
                )
                # Switch to the new window.
                new_window.switch_to()

                # checks in the destination's window
                tab = new_window.tabbar.selected_tab
                self.tabs.wait_until_loaded(tab)
                self.assertEqual(tab.location, link_url,
                                 "The location in the new window is correct.")
                self.assertFalse(self.redir.is_shown(),
                                 ("Following the link didn't cause a "
                                  "redirect in the destination window."))

                # Close the new window.
                self.windows.close_all(exceptions=[self.main_window])
                # It's necessary to switch back to the main window.
                self.main_window.switch_to()

                # checks in the origin's window
                self.assertFalse(self.redir.is_shown(),
                                 ("Following the link didn't cause a "
                                  "redirect in the origin tab."))


    def open_link_multi(self, link):
        """Open a link in new window using different methods."""

        context_menu_ids = [
            "context-openlink",  # Open Link in New Window
            "context-openlinkprivate"  # Open Link in New Private Window
        ]

        for id in context_menu_ids:
            self.ctx_menu.select_entry(id, link)
            yield
