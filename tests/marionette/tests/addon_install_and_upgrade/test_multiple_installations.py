# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.addon import Addon
from marionette_driver.errors import NoSuchElementException


# v1.0.beta9.3
RP_BETA_9 = {"id": "requestpolicy@requestpolicy.com",
             "xpi": "requestpolicy-v1.0.beta9.3__preprocess.py.xpi"}
# AMO version
RP_AMO = {"id": "rpcontinued@amo.requestpolicy.org",
          "xpi": "requestpolicy-amo.xpi"}

NOTICE_URL = "chrome://rpcontinued/content/multiple-installations.html"


class MultipleInstallationsTestCase(RequestPolicyTestCase):
    OTHER_ADDON = None

    def setUp(self):
        super(MultipleInstallationsTestCase, self).setUp()

        self.rp_addon.ignore_errors = True

        assert self.OTHER_ADDON is not None
        self.other_rp = Addon(lambda: self.marionette,
                              addon_id=self.OTHER_ADDON["id"],
                              install_url=("http://localhost/.dist/" +
                                           self.OTHER_ADDON["xpi"]))

    def tearDown(self):
        try:
            self.other_rp.uninstall()
            self.rp_addon.install()

            # Restart the browser. (It's a method of FirefoxTestCase.)
            # It's necessary to restart because multiple installed versions
            # might have broken RequestPolicy's functionality.
            self.restart()
        finally:
            self.browser.tabbar.close_all_tabs(
                exceptions=[self.browser.tabbar.tabs[0]])
            self.rp_addon.ignore_errors = False

            # It's highly probable that errors occur. However, the tests
            # in this file don't intend to avoid these errors.
            self.logging_error_detect.reset()
            self.console_error_detect.reset()

            super(MultipleInstallationsTestCase, self).tearDown()

    def _get_notice_tabs(self):
        tabs = self.browser.tabbar.tabs
        notice_tabs = []
        for tab in tabs:
            if tab.location == NOTICE_URL:
                notice_tabs.append(tab)
        return notice_tabs

    @property
    def _notice_tab(self):
        sel_tab = self.browser.tabbar.selected_tab
        if sel_tab.location == NOTICE_URL:
            return sel_tab
        notice_tabs = self._get_notice_tabs()
        if len(notice_tabs) > 0:
            return notice_tabs[0]
        return None

    def _assert_notice_tab(self, selected_required=True):
        tab = self._notice_tab
        self.assertIsNotNone(tab, msg=("The 'multiple installations notice' "
                                       "tab has been opened."))

        if selected_required:
            self.assertTrue(tab.selected,
                            msg=("The 'multiple installations notice' tab "
                                 "has been selected."))
        else:
            tab.select()

        with self.marionette.using_context("content"):
            try:
                self.marionette.find_element("xpath",
                                             "//*[contains(text(),'Notice')]")
            except NoSuchElementException:
                self.fail("The Notice Tab should contain the word 'Notice'.")

    def _close_notice_tabs(self):
        tabs = self._get_notice_tabs()
        for tab in tabs:
            tab.close()


class CommonTests:
    """Common tests for all so-called "other" versions.

    Idea from
    https://stackoverflow.com/questions/1323455/python-unit-test-with-base-and-sub-class/25695512#25695512
    """

    class OtherVersionActive_ThenInstallCurrentVersion(MultipleInstallationsTestCase):
        def test_notice_is_shown(self):
            self.rp_addon.uninstall()
            self.other_rp.install()

            self.rp_addon.install()
            self._assert_notice_tab()

    class OtherVersionActive_ThenEnableCurrentVersion(MultipleInstallationsTestCase):
        def test_notice_is_shown(self):
            self.rp_addon.disable()
            self.other_rp.install()

            self.rp_addon.enable()
            self._assert_notice_tab()

    class OtherVersionNotActive_ThenInstall(MultipleInstallationsTestCase):
        def test_notice_is_shown(self):
            self.other_rp.install()
            self._assert_notice_tab()

    class OtherVersionNotActive_ThenEnable(MultipleInstallationsTestCase):
        def test_notice_is_shown(self):
            # After this preparation, both the current and the old version
            # will be installed, but the old version will be disabled.
            self.rp_addon.disable()
            self.other_rp.install()
            self.other_rp.disable()
            self.rp_addon.enable()
            self.assertIsNone(self._notice_tab,
                              msg=("No 'notice' tab has been opened during "
                                   "preparation"))

            self.other_rp.enable()
            self._assert_notice_tab()

    class OtherAndCurrentVersionActiveAfterRestart(MultipleInstallationsTestCase):
        def test_notice_is_shown(self):
            self.other_rp.install()
            self._close_notice_tabs()

            self.restart()
            # Don't require the tab to be selected. It somehow doesn't get
            # selected in the unit test, but it works when done manually.
            self._assert_notice_tab(selected_required=False)


class TestAMOVersionActive_ThenInstallCurrentVersion(\
        CommonTests.OtherVersionActive_ThenInstallCurrentVersion):
    OTHER_ADDON = RP_AMO

class TestAMOVersionActive_ThenEnableCurrentVersion(\
        CommonTests.OtherVersionActive_ThenEnableCurrentVersion):
    OTHER_ADDON = RP_AMO

class TestAMOVersionNotActive_ThenInstall(\
        CommonTests.OtherVersionNotActive_ThenInstall):
    OTHER_ADDON = RP_AMO

class TestAMOVersionNotActive_ThenEnable(\
        CommonTests.OtherVersionNotActive_ThenEnable):
    OTHER_ADDON = RP_AMO

class TestAMOAndNonAMOVersionActiveAfterRestart(\
        CommonTests.OtherAndCurrentVersionActiveAfterRestart):
    OTHER_ADDON = RP_AMO


class TestOldVersionActive_ThenInstallCurrentVersion(\
        CommonTests.OtherVersionActive_ThenInstallCurrentVersion):
    OTHER_ADDON = RP_BETA_9

class TestOldVersionActive_ThenEnableCurrentVersion(\
        CommonTests.OtherVersionActive_ThenEnableCurrentVersion):
    OTHER_ADDON = RP_BETA_9

class TestOldVersionNotActive_ThenInstall(\
        CommonTests.OtherVersionNotActive_ThenInstall):
    OTHER_ADDON = RP_BETA_9

class TestOldVersionNotActive_ThenEnable(\
        CommonTests.OtherVersionNotActive_ThenEnable):
    OTHER_ADDON = RP_BETA_9

class TestOldAndCurrentVersionActiveAfterRestart(\
        CommonTests.OtherAndCurrentVersionActiveAfterRestart):
    OTHER_ADDON = RP_BETA_9
