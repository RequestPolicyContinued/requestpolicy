# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette_driver.marionette import Actions
from rp_puppeteer.errors import ElementNotDisplayedException
from contextlib import contextmanager


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClickRedirectInNewTab(RequestPolicyTestCase):

    def setUp(self):
        super(TestLinkClickRedirectInNewTab, self).setUp()

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestLinkClickRedirectInNewTab, self).tearDown()

    def test_redirect_notification_appears_or_not(self):
        tabbar = self.browser.tabbar

        def test_no_appear(test_url, *args):
            open_page_and_open_first_link_in_new_tab(test_url, *args)

            # Select the new tab
            tabbar.tabs[1].select()

            # FIXME: Find a better way to ensures that the part of RP which
            #        is responsible for showing the panel _really_ has
            #        finished.
            self.assertNotEqual(self.marionette.get_url(), test_url,
                                "The URL in the urlbar has changed.")
            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification in the "
                             "destination tab.")

            # Close the new tab.
            tabbar.close_tab()

            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification in the "
                             "origin tab.")

        def test_appear(test_url, *args):
            open_page_and_open_first_link_in_new_tab(test_url, *args)

            # Select the new tab
            tabbar.tabs[1].select()

            self.assertTrue(self.redir.is_shown(),
                            "The redirect notification has been displayed "
                            "in the destination tab.")

            # Close the new tab.
            tabbar.close_tab()

            self.assertFalse(self.redir.is_shown(),
                             "There's no redirect notification in the "
                             "origin tab.")

        def open_page_and_open_first_link_in_new_tab(test_url, open_tab_method):
            with self.marionette.using_context("content"):
                self.marionette.navigate(test_url)
                link = self.marionette.find_element("tag name", "a")

            if open_tab_method == "middleClick":
                with self.marionette.using_context("content"):
                    Actions(self.marionette).click(link, 1).perform()
            elif open_tab_method == "contextMenu":
                self.ctx_menu.select_entry("context-openlinkintab", link)
                # TODO: Use the "tabs" library as soon as it has been ported
                #       to Marionette, see Mozilla Bug 1121725.
                #       The mozmill code to open the link in a new tab was:
                #       ```
                #       tabBrowser.openTab({method: "contextMenu", target: link});
                #       ```


        def expand_url(path, option="page with link"):
            if option == "page with link":
                path = "link.html?" + path
            return "http://www.maindomain.test/" + path

        @contextmanager
        def assert_raises_if(exc_class, condition):
            """Wrap into `assertRaises()` if the condition evaluates to true."""

            if condition:
                with self.assertRaises(exc_class):
                    yield
            else:
                yield

        def test_variant(*args):
            with assert_raises_if(ElementNotDisplayedException,
                                  args[0] == "contextMenu"):
                # The "Open Link in New Tab" context menu entry is not
                # available for <a> elements with such hrefs containing
                # JavaScript code.
                test_appear(expand_url("redirect-js-document-location-link.html",
                                       option="no link creation"), *args)

            test_appear(expand_url("redirect-http-location-header.php"), *args)
            test_appear(expand_url("redirect-http-refresh-header.php"), *args)
            test_appear(expand_url("redirect-js-document-location-auto.html"), *args)
            test_appear(expand_url("redirect-meta-tag-01-immediate.html"), *args)
            test_appear(expand_url("redirect-meta-tag-02-delayed.html"), *args)
            test_appear(expand_url("redirect-meta-tag-03-multiple.html"), *args)
            test_appear(expand_url("redirect-meta-tag-08.html"), *args)

            test_no_appear(expand_url("redirect-meta-tag-04-relative-without-slash.html"), *args)
            test_no_appear(expand_url("redirect-meta-tag-05-relative-with-slash.html"), *args)
            test_no_appear(expand_url("redirect-meta-tag-06-different-formatting.html"), *args)
            test_no_appear(expand_url("redirect-meta-tag-07-different-formatting-delayed.html"), *args)
            test_no_appear(expand_url("redirect-meta-tag-09-relative.html"), *args)


        test_variant("middleClick")
        test_variant("contextMenu")
