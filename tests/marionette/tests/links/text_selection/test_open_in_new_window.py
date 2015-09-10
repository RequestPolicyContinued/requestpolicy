# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.ui.redirect_notification import RedirectNotification
from rp_puppeteer.ui.context_menu import ContextMenu
from rp_puppeteer.ui.tabs import Tabs
from rp_puppeteer.ui.web_utils import WebUtils


TEST_URL = "http://www.maindomain.test/link_1.html";
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestOpenInNewWindow(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False);

        self.redir = RedirectNotification(lambda: self.marionette)
        self.web_utils = WebUtils(lambda: self.marionette)
        self.tabs = Tabs(lambda: self.marionette)
        self.ctx_menu = ContextMenu(lambda: self.marionette)

        self.origin_window = self.windows.current

    def tearDown(self):
        self.windows.close_all(exceptions=[self.origin_window])
        RequestPolicyTestCase.tearDown(self)

    def test_open_in_new_window(self):
        with self.marionette.using_context("content"):
            # load the test url
            self.marionette.navigate(TEST_URL)

            # find the URL string and its wrapping element
            url_wrapper = self.marionette.find_element("id", "text_url_1")
            url = url_wrapper.get_attribute("textContent")

            # select the URL
            self.web_utils.select_element_text(url_wrapper)

        with self.marionette.using_context("chrome"):
            for _ in self.open_sel_url_multi(url_wrapper):
                self.assertEqual(len(self.windows.all), 2,
                                 "A new window has been opened.")

                dest_window_handle = self.windows.focused_chrome_window_handle
                self.assertNotEqual(dest_window_handle, self.origin_window.handle,
                                    "The new window has been focused.")
                dest_window = self.windows.create_window_instance(
                    dest_window_handle
                )

                # Await page load.
                dest_tab = dest_window.tabbar.selected_tab
                self.tabs.wait_until_loaded(dest_tab)

                # Do checks in the destination's window.
                dest_window.switch_to()
                self.assertEqual(dest_tab.location, url,
                                 "The location in the new window is correct.")
                self.assertFalse(self.redir.panel_exists(),
                                 ("Following the link didn't cause a "
                                  "redirect in the destination window."))

                # Close the new window.
                self.windows.close_all(exceptions=[self.origin_window])

                # Do checks in the origin's window.
                self.origin_window.switch_to()
                self.assertFalse(self.redir.panel_exists(),
                                 ("Following the link didn't cause a "
                                  "redirect in the origin window."))

    def open_sel_url_multi(self, url_wrapper):
        """Open a selected URL in new window using different methods."""

        context_menu_ids = [
            "context-openlink",       # Open Link in New Window
            "context-openlinkprivate" # Open Link in New Private Window
        ]

        for id in context_menu_ids:
            self.ctx_menu.select_entry(id, url_wrapper)
            yield
