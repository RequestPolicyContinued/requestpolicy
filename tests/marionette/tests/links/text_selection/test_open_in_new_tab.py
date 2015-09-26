# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


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

            # find the URL string and its wrapping element
            url_wrapper = self.marionette.find_element("id", "text_url_1")
            url = url_wrapper.get_attribute("textContent")

            # select the URL
            self.web_utils.select_element_text(url_wrapper)

        with self.marionette.using_context("chrome"):
            # perform right-click and entry selection
            self.ctx_menu.select_entry("context-openlinkintab", url_wrapper)

            self.assertEqual(len(self.browser.tabbar.tabs), 2,
                             "A new tab has been opened.")

            [origin_tab, dest_tab] = self.browser.tabbar.tabs
            self.tabs.wait_until_loaded(dest_tab)

            # checks in the origin's tab
            origin_tab.switch_to()
            self.assertFalse(self.redir.panel_exists(),
                             ("Following the link didn't cause a "
                              "redirect in the origin tab."))

            # checks in the destination's tab
            dest_tab.switch_to()
            self.assertEqual(dest_tab.location, url,
                             "The location in the new tab is correct.")
            self.assertFalse(self.redir.panel_exists(),
                             ("Following the link didn't cause a "
                              "redirect in the destination tab."))

            dest_tab.close()
