# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness import FirefoxTestCase

from rp_puppeteer.ui.addons import Addons, AboutAddonsTab


ADDON_ID = "dummy-ext@requestpolicy.org"
INSTALL_URL = "http://localhost/link.html?.dist/dummy-ext.xpi"


class AddonsTestCase(FirefoxTestCase):
    def selected_tab_is_about_addons(self):
        location = self.browser.tabbar.selected_tab.location
        return location == "about:addons"

    def extension_category_is_selected(self):
        if not self.selected_tab_is_about_addons():
            return False
        with self.marionette.using_context("content"):

            # Using `get_attribute` does not work here. It raises
            # an exception: "Element is not selectable".
            rv = self.marionette.execute_script(
                """
                let category = document.getElementById("category-extension");
                return category.getAttribute("selected");
                """);
            return rv == "true"

    def count_tabs(self):
        return len(self.browser.tabbar.tabs)


class TestAddons(AddonsTestCase):
    def setUp(self):
        AddonsTestCase.setUp(self)
        self.addons = Addons(lambda: self.marionette)
        self.addons.install_addon(INSTALL_URL)

    def tearDown(self):
        try:
            self.addons.remove_addon_by_id(ADDON_ID)
        finally:
            AddonsTestCase.tearDown(self)

    def test_using_addon_list(self):
        num_tabs = self.count_tabs()
        self.assertFalse(self.selected_tab_is_about_addons())
        with self.addons.using_addon_list() as about_addons:
            self.assertIsInstance(about_addons, AboutAddonsTab)
            self.assertTrue(self.selected_tab_is_about_addons())
            self.assertTrue(self.extension_category_is_selected())
            self.assertEqual(self.count_tabs(), num_tabs + 1,
                             msg="The number of tabs has increased by one.")
        self.assertFalse(self.selected_tab_is_about_addons())
        self.assertEqual(self.count_tabs(), num_tabs,
                         msg="The number of tabs is like in the beginning.")

    def test_uninstall_install(self):
        def is_installed():
            with self.addons.using_addon_list() as about_addons:
                return about_addons.is_addon_installed(ADDON_ID)

        self.assertTrue(is_installed())
        self.addons.remove_addon_by_id(ADDON_ID)
        self.assertFalse(is_installed())
        self.addons.install_addon(INSTALL_URL)
        self.assertTrue(is_installed())

    def test_multiple_uninstall_install(self):
        self.addons.remove_addon_by_id(ADDON_ID)
        self.addons.remove_addon_by_id(ADDON_ID)
        self.addons.install_addon(INSTALL_URL)
        self.addons.install_addon(INSTALL_URL)

    def test_disable_enable(self):
        def is_enabled():
            with self.addons.using_addon_list() as about_addons:
                addon = about_addons.get_addon_by_id(ADDON_ID)
                return addon.is_enabled()

        self.assertTrue(is_enabled())
        self.addons.disable_addon_by_id(ADDON_ID)
        self.assertFalse(is_enabled())
        self.addons.enable_addon_by_id(ADDON_ID)
        self.assertTrue(is_enabled())

    def test_multiple_disable_enable(self):
        self.addons.disable_addon_by_id(ADDON_ID)
        self.addons.disable_addon_by_id(ADDON_ID)
        self.addons.enable_addon_by_id(ADDON_ID)
        self.addons.enable_addon_by_id(ADDON_ID)


class TestAboutAddons(AddonsTestCase):
    def setUp(self):
        FirefoxTestCase.setUp(self)

        Addons(lambda: self.marionette).install_addon(INSTALL_URL)

        self.about_addons = AboutAddonsTab(lambda: self.marionette)
        self.about_addons.open_tab()
        self.about_addons.set_category_by_id("extension")

    def tearDown(self):
        try:
            if self.about_addons.is_addon_installed(ADDON_ID):
                self.about_addons.remove_addon(self.addon)
            self.about_addons.close_tab()
        finally:
            FirefoxTestCase.tearDown(self)

    @property
    def addon(self):
        return self.about_addons.get_addon_by_id(ADDON_ID)

    def test_close_tab_open_tab(self):
        self.assertTrue(self.selected_tab_is_about_addons())
        self.about_addons.close_tab()
        self.assertFalse(self.selected_tab_is_about_addons())
        self.about_addons.open_tab()
        self.assertTrue(self.selected_tab_is_about_addons())

    def test_disable_enable(self):
        """Test the methods `disable`, `enable` and `is_enabled`.
        """
        self.assertTrue(self.addon.is_enabled(), msg="The addon is enabled.")
        self.about_addons.disable_addon(self.addon)
        self.assertFalse(self.addon.is_enabled(),
                         msg="The addon has been disabled.")
        self.about_addons.enable_addon(self.addon)
        self.assertTrue(self.addon.is_enabled(),
                        msg="The addon is enabled again.")

    def test_uninstall(self):
        def is_installed():
            return self.about_addons.is_addon_installed(ADDON_ID)

        self.assertTrue(is_installed(), msg="The addon is installed.")
        self.about_addons.remove_addon(self.addon)

        # The addon should be already uninstalled when `remove`
        # returns. Therefore there is no "wait until".
        self.assertFalse(is_installed(), msg="The addon has been removed.")
