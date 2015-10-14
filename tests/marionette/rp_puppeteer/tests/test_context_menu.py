# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from rp_puppeteer.errors import ElementNotDisplayedException
from marionette_driver.errors import NoSuchElementException


class TestLinkClickRedirectInNewTab(RequestPolicyTestCase):

    def setUp(self):
        super(TestLinkClickRedirectInNewTab, self).setUp()

        # A page with a link to the domain's root.
        self.test_url = "http://www.maindomain.test/link.html?/"
        with self.marionette.using_context("content"):
            self.marionette.navigate(self.test_url)
            self.link = self.marionette.find_element("tag name", "a")
        self.origin_tab = self.browser.tabbar.selected_tab

    def tearDown(self):
        try:
            self.browser.tabbar.close_all_tabs(exceptions=[self.origin_tab])
        finally:
            super(TestLinkClickRedirectInNewTab, self).tearDown()

    def test_select_entry__normal(self):
        # Open Link in New Tab.
        self.ctx_menu.select_entry("context-openlinkintab", self.link)
        self.assertEqual(self.browser.tabbar.selected_tab, self.origin_tab,
                         "The tab has not changed.")
        self.assertEqual(self.ctx_menu.state, "closed")

    def test_select_entry__nonexistant(self):
        with self.assertRaises(NoSuchElementException):
            self.ctx_menu.select_entry("foo-bar-nonexistant", self.link)
        self.assertEqual(self.ctx_menu.state, "closed")

    def test_select_entry__invisible(self):
        with self.assertRaises(ElementNotDisplayedException):
            # Select the "Copy" entry, which exists but is not shown when
            # right-clicking on a link.
            self.ctx_menu.select_entry("context-copy", self.link)
        self.assertEqual(self.ctx_menu.state, "closed")
