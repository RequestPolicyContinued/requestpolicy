# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


TEST_URL = "http://www.maindomain.test/link_1.html";
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestOpenInCurrentTab(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False);


    def test_open_in_current_tab(self):
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
            self.ctx_menu.select_entry("context-openlinkincurrent", url_wrapper)

            tab = self.browser.tabbar.selected_tab
            self.tabs.wait_until_loaded(tab)

            self.assertFalse(self.redir.panel_exists(),
                             "Following the URL didn't cause a redirect.")
            self.assertEqual(tab.location, url,
                             "The location is correct.")
