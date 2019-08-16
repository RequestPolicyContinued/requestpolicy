# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette_driver.marionette import Actions
from rp_puppeteer.errors import ElementNotDisplayedException
from contextlib import contextmanager
from rp_ui_harness.utils import redirections


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClickRedirectInNewTab:
    class Test(RequestPolicyTestCase):
        variant_args = None

        def setUp(self):
            super(TestLinkClickRedirectInNewTab.Test, self).setUp()

            self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        def tearDown(self):
            try:
                self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
            finally:
                super(TestLinkClickRedirectInNewTab.Test, self).tearDown()

        ################
        # Test Methods #
        ################

        def test_redirect_notification_appears_or_not(self):
            tabbar = self.browser.tabbar

            def test_no_appear(test_url, dest_url, info, *args):
                open_page_and_open_first_link_in_new_tab(test_url, *args)

                # Select the new tab
                tabbar.tabs[1].select()

                redirections.assert_redir_is_shown(
                    self, test_url, dest_url, is_shown=False,
                    additional_info="destination tab")
                redirections.wait_until_url_load(self, dest_url)
                redirections.assert_redir_is_shown(
                    self, test_url, dest_url, is_shown=False,
                    additional_info="destination tab")

                # Close the new tab.
                tabbar.close_tab()

                redirections.assert_redir_is_shown(
                    self, test_url, dest_url, is_shown=False,
                    additional_info="origin tab")

            def test_appear(test_url, dest_url, info, *args):
                open_page_and_open_first_link_in_new_tab(test_url, *args)

                # Select the new tab
                tabbar.tabs[1].select()

                redirections.assert_redir_is_shown(
                    self, test_url, dest_url, is_shown=True,
                    additional_info="destination tab")
                redirections.assert_url_does_not_load(
                    self, dest_url,
                    expected_delay=info["delay"])

                # Close the new tab.
                tabbar.close_tab()

                redirections.assert_redir_is_shown(
                    self, test_url, dest_url, is_shown=False,
                    additional_info="origin tab")

            def open_page_and_open_first_link_in_new_tab(
                test_url, open_tab_method
            ):
                with self.marionette.using_context("content"):
                    self.marionette.navigate(test_url)
                    link = self.marionette.find_element("tag name", "a")

                if open_tab_method == "middleClick":
                    with self.marionette.using_context("content"):
                        Actions(self.marionette).click(link, 1).perform()
                elif open_tab_method == "contextMenu":
                    self.ctx_menu.select_entry("context-openlinkintab", link)
                    # TODO:
                    #   Use the "tabs" library as soon as it has been ported
                    #   to Marionette, see Mozilla Bug 1121725.
                    #   The mozmill code to open the link in a new tab was:
                    #   ```
                    #   tabBrowser.openTab({method: "contextMenu", target: link});
                    #   ```

            def expand_url(path, option="page with link"):
                if option == "page with link":
                    path = "link.html?" + path
                return "http://www.maindomain.test/" + path

            def test(test_url, dest_url, info):
                if info["is_same_host"]:
                    test_no_appear(test_url, dest_url, info, *self.variant_args)
                else:
                    test_appear(test_url, dest_url, info, *self.variant_args)

            def maybe_test((test_url, _, dest_url), info):
                if (
                    info["redirection_method"] ==
                        "js:document.location:<a> href"
                ):
                    if info["is_relative_dest"]:
                        # Examplary relative href:
                        #     javascript:document.location = '/index.html'
                        # This works for a left-click, but not for
                        # "open in new tab". In a new tab, an absolute URI
                        # is needed.
                        return

                    if info["is_same_host"]:
                        # Example:
                        #     On site "http://www.maindomain.test/...":
                        #     javascript:document.location =
                        #         'http://www.maindomain.test/'
                        # Up to Fx51, the origin of the request when
                        # middle-clicking is "about:blank". However,
                        # on Fx52, the origin is the real URL, i.e.,
                        # "http://www.maindomain.test/...". -- So depending
                        # on the firefox version, the request is allowed
                        # or not. Allowing the request is okay, since it's
                        # a same-site request, so we simply skip this
                        # test case.
                        return

                    # FIXME: Issue #725
                    #   This test fails with E10s enabled.
                    #   When FxPuppeteer's `TabBar.get_handle_for_tab()` is
                    #   executed for the new tab with the test URL, the
                    #   `contentWindowAsCPOW` either is `null` or does not
                    #   have a `QueryInterface()` function.
                    if self.browser_info.e10s_enabled:
                        return

                    # The "Open Link in New Tab" context menu entry is not
                    # available for <a> elements with such hrefs containing
                    # JavaScript code.
                    if self.variant_args[0] == "contextMenu":
                        with self.assertRaises(ElementNotDisplayedException):
                            test(test_url, dest_url, info)
                        return

                test(test_url, dest_url, info)

            try:
                redirections.for_each_possible_redirection_scenario(maybe_test,
                                                                    "link")
            except:  # noqa
                print "test variant: " + str(self.variant_args[0])
                raise


class TestLinkClickRedirectInNewTab_MiddleClick(TestLinkClickRedirectInNewTab.Test):
    variant_args = ["middleClick"]


class TestLinkClickRedirectInNewTab_ContextMenu(TestLinkClickRedirectInNewTab.Test):
    variant_args = ["contextMenu"]
