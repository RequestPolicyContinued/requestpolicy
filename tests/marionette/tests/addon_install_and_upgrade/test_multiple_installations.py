# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.ui.addons import RequestPolicy, Addons


OLD_VERSION__ADDON_ID = "requestpolicy@requestpolicy.com"
AMO_VERSION__ADDON_ID = "rpcontinued@requestpolicy.org"

def _install_url(filename):
    return "http://localhost/link.html?.dist/" + filename

OLD_VERSION__INSTALL_URL = _install_url("requestpolicy-v1.0.beta9.3.xpi")
AMO_VERSION__INSTALL_URL = _install_url("requestpolicy-amo.xpi")


NOTICE_URL = "chrome://rpcontinued/content/multiple-installations.html"


class MultipleInstallationsTestCase(RequestPolicyTestCase):
    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.rp = RequestPolicy(lambda: self.marionette)
        self.addons = Addons(lambda: self.marionette)

    def tearDown(self):
        self._close_notice_tabs()
        # Restart the browser. (It's a method of FirefoxTestCase.)
        # It's necessary to restart because multiple installed versions
        # might have broken RequestPolicy's functionality.
        self.restart()
        RequestPolicyTestCase.tearDown(self)

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
            # check if the word "Notice" is on the page
            notice = self.marionette.find_element(
                "xpath",
                "//*[contains(text(),'Notice')]")

    def _close_notice_tabs(self):
        tabs = self._get_notice_tabs()
        for tab in tabs:
            tab.close()


class OldVersionTestCase(MultipleInstallationsTestCase):
    INSTALL_URL = OLD_VERSION__INSTALL_URL
    ADDON_ID = OLD_VERSION__ADDON_ID
    def tearDown(self):
        self.addons.remove_addon_by_id(self.ADDON_ID)
        MultipleInstallationsTestCase.tearDown(self)


class TestOldVersionActive_ThenInstallCurrentVersion(OldVersionTestCase):
    def setUp(self):
        OldVersionTestCase.setUp(self)
        self.rp.remove()
        self.addons.install_addon(self.INSTALL_URL)

    def test_notice_is_shown(self):
        with self.rp.install_in_two_steps():
            self._assert_notice_tab()

class TestOldVersionActive_ThenEnableCurrentVersion(OldVersionTestCase):
    def setUp(self):
        OldVersionTestCase.setUp(self)
        self.rp.disable()
        self.addons.install_addon(self.INSTALL_URL)

    def test_notice_is_shown(self):
        self.rp.enable()
        self._assert_notice_tab()

class TestOldVersionNotActive_ThenInstall(OldVersionTestCase):
    def test_notice_is_shown(self):
        with self.addons.install_addon_in_two_steps(self.INSTALL_URL):
            self._assert_notice_tab()

class TestOldVersionNotActive_ThenEnable(OldVersionTestCase):
    def setUp(self):
        OldVersionTestCase.setUp(self)
        # After this preparation, both the current and the old version
        # will be installed, but the old version will be disabled.
        self.rp.disable()
        self.addons.install_addon(self.INSTALL_URL)
        self.addons.disable_addon_by_id(self.ADDON_ID)
        self.rp.enable()
        self.assertIsNone(self._notice_tab,
                          msg=("No 'notice' tab has been opened during "
                               "preparation"))

    def test_notice_is_shown(self):
        self.addons.enable_addon_by_id(self.ADDON_ID)
        self._assert_notice_tab()

class TestOldAndCurrentVersionActiveAfterRestart(OldVersionTestCase):
    def setUp(self):
        OldVersionTestCase.setUp(self)
        self.addons.install_addon(self.INSTALL_URL)
        self._close_notice_tabs()

    def test_notice_is_shown(self):
        self.restart()
        # Don't require the tab to be selected. It somehow doesn't get
        # selected in the unit test, but it works when done manually.
        self._assert_notice_tab(selected_required=False)


class TestAMOVersionActive_ThenInstallCurrentVersion(\
        TestOldVersionActive_ThenInstallCurrentVersion):
    INSTALL_URL = AMO_VERSION__INSTALL_URL
    ADDON_ID = AMO_VERSION__ADDON_ID

class TestAMOVersionActive_ThenEnableCurrentVersion(\
        TestOldVersionActive_ThenEnableCurrentVersion):
    INSTALL_URL = AMO_VERSION__INSTALL_URL
    ADDON_ID = AMO_VERSION__ADDON_ID

class TestAMOVersionNotActive_ThenInstall(\
        TestOldVersionNotActive_ThenInstall):
    INSTALL_URL = AMO_VERSION__INSTALL_URL
    ADDON_ID = AMO_VERSION__ADDON_ID

class TestAMOVersionNotActive_ThenEnable(\
        TestOldVersionNotActive_ThenEnable):
    INSTALL_URL = AMO_VERSION__INSTALL_URL
    ADDON_ID = AMO_VERSION__ADDON_ID

class TestAMOAndNonAMOVersionActiveAfterRestart(\
        TestOldAndCurrentVersionActiveAfterRestart):
    INSTALL_URL = AMO_VERSION__INSTALL_URL
    ADDON_ID = AMO_VERSION__ADDON_ID
