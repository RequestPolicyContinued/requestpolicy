# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette import SkipTest


URLS = {
    1: ["http://www.maindomain.test/"],
    2: ["http://www.otherdomain.test/"],
    3: ["http://www.thirddomain.test/"],
    "preferences": ["about:requestpolicy", "about:requestpolicy?basicprefs"],
    "preferences_1": ["about:requestpolicy"],
    "preferences_2": ["about:requestpolicy?basicprefs"],
    "policies": ["about:requestpolicy?yourpolicy"]
}


class TestSettingsButtons(RequestPolicyTestCase):

    TEST_URL = "http://www.maindomain.test/img_1.html"

    def setUp(self):
        super(TestSettingsButtons, self).setUp()
        self.tabbar = self.browser.tabbar

    def tearDown(self):
        try:
            self._close_all_tabs()
        finally:
            super(TestSettingsButtons, self).tearDown()

    @property
    def disabled(self):
        return not self.menu.is_working

    @property
    def skip_if_disabled(self):
        if self.disabled:
            raise SkipTest("menu is defunct")

    ################
    # Test Methods #
    ################

    def _test__should_open(self, url_id, settings_id):
        """Exactly one settings tab is open, which is at the same
        time the one to be opened."""

        self._open_tabs([1, url_id, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([1, url_id, settings_id, 3], 2)

    def test_no_settings_tab_open(self):
        self.skip_if_disabled()

        """No settings tab is open."""
        self._test__should_open(2, "preferences")
        self._test__should_open(2, "policies")

    def test_non_equivalent_settings_tab_open(self):
        self.skip_if_disabled()

        """A non-equivalent settings tab is open."""
        self._test__should_open("policies", "preferences")
        self._test__should_open("preferences_1", "policies")
        self._test__should_open("preferences_2", "policies")

    def _test__basic(self, url_id, settings_id):
        """Exactly one settings tab is open, which is at the same
        time the one to be opened."""

        # Already on the correct tab
        self._open_tabs([1, url_id, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([1, url_id, 3], 1)

        # Switch to the correct tab
        self._open_tabs([url_id, 2, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([url_id, 2, 3], 0)

    def test_preferences__basic(self):
        self.skip_if_disabled()

        self._test__basic("preferences_1", "preferences")
        self._test__basic("preferences_2", "preferences")

    def test_policies__basic(self):
        self.skip_if_disabled()

        self._test__basic("policies", "policies")

    def _test__multiple_equivalent_urls(self, url_id_1, url_id_2, settings_id):
        """Multiple settings tabs are open, but all are equivalent.

        However, the URLs still could be different; for example,
        "about:requestpolicy" and "about:requestpolicy?basicprefs"
        are equivalent.
        """

        # Already on the correct tab
        self._open_tabs([url_id_1, url_id_2, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([url_id_1, url_id_2, 3], 1)

        # Switch to the correct tab.
        # The tab to the right of the current tab should be selected.
        self._open_tabs([url_id_1, 2, url_id_2], 1)
        self._open_settings(settings_id)
        self._check_tabs([url_id_1, 2, url_id_2], 2)

    def test_preferences__multiple(self):
        self.skip_if_disabled()

        self._test__multiple_equivalent_urls("preferences_1", "preferences_1",
                                             "preferences")
        self._test__multiple_equivalent_urls("preferences_1", "preferences_2",
                                             "preferences")
        self._test__multiple_equivalent_urls("preferences_2", "preferences_1",
                                             "preferences")

    def _test__multiple_non_equivalent_urls(
        self, url_id, non_equivalent_url_id, settings_id
    ):
        """Multiple settings tabs are open, but they are _not_ equivalent."""

        # Already on the correct tab
        self._open_tabs([non_equivalent_url_id, url_id, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([non_equivalent_url_id, url_id, 3], 1)

        # Switch to the correct tab (to the left of the current tab).
        self._open_tabs([url_id, 2, non_equivalent_url_id], 1)
        self._open_settings(settings_id)
        self._check_tabs([url_id, 2, non_equivalent_url_id], 0)

        # Switch to the correct tab (to the left of the current tab).
        # The current tab is the non-equivalent tab.
        self._open_tabs([url_id, non_equivalent_url_id, 3], 1)
        self._open_settings(settings_id)
        self._check_tabs([url_id, non_equivalent_url_id, 3], 0)

    def test_preferences__with_other_settings_tabs(self):
        self.skip_if_disabled()

        self._test__multiple_non_equivalent_urls("preferences_1", "policies",
                                                 "preferences")
        self._test__multiple_non_equivalent_urls("preferences_2", "policies",
                                                 "preferences")

    ##########################
    # Private Helper Methods #
    ##########################

    def _open_tabs(self, tabs, select_index=1):
        self._close_all_tabs()

        first_tab = True
        for tab_id in tabs:
            if not first_tab:
                self.tabbar.open_tab().select()
            url = URLS[tab_id][0]
            with self.marionette.using_context("content"):
                self.marionette.navigate(url)
            if first_tab:
                first_tab = False
        self.tabbar.tabs[select_index].select()
        self._check_tabs(tabs, select_index)

    def _close_all_tabs(self):
        self.tabbar.close_all_tabs(exceptions=[self.tabbar.tabs[0]])

    def _check_tabs(self, tabs, expected_selected_index):
        self.assertEqual(expected_selected_index, self.tabbar.selected_index)
        expected_tab_urls = [URLS[tab_id] for tab_id in tabs]
        tab_urls = [tab.location for tab in self.tabbar.tabs]
        self.assertEqual(len(expected_tab_urls), len(expected_tab_urls))
        for idx in range(len(expected_tab_urls)):
            possible_tab_urls = expected_tab_urls[idx]
            tab_url = tab_urls[idx]
            self.assertIn(tab_url, possible_tab_urls)

        self.tabbar.tabs[expected_selected_index].select()
        self.assertEqual(expected_selected_index, self.tabbar.selected_index)

    def _open_settings(self, button):
        self.menu.open()
        with self.menu.in_iframe():
            if button == "preferences":
                self.menu.preferences_button.click()
            elif button == "policies":
                self.menu.manage_policies_button.click()
            else:
                self.fail()
