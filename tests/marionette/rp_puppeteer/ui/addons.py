# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette_driver.errors import NoSuchElementException
from marionette_driver.wait import Wait
from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.ui.windows import Windows
from contextlib import contextmanager


class _InstallNotifications(object):
    """This class provides methods for managing the install notificaitons.
    """

    def __init__(self, marionette):
        self.marionette = marionette
        self.wait = Wait(self.marionette)

    def is_hidden(self, notification_id):
        with self.marionette.using_context("chrome"):
            try:
                hidden_attr = (
                        self.marionette
                        .find_element("id", notification_id)
                        .get_attribute("hidden")
                    )
                return hidden_attr == "true"
            except NoSuchElementException:
                return True

    def wait_until_not_hidden(self, notification_id):
        self.wait.until(
            lambda m: not self.is_hidden(notification_id),
            message=("Notification with ID {} is shown."
                     .format(notification_id)))

    def wait_until_hidden(self, notification_id):
        self.wait.until(
            lambda m: self.is_hidden(notification_id),
            message=("Notification with ID {} is hidden."
                     .format(notification_id)))

    @contextmanager
    def wrap_lifetime(self, notification_id):
        """Yields as soon as the notification is shown, and
        finally returns as soon as the notification is hidden."""

        self.wait_until_not_hidden(notification_id)
        try:
            yield
        finally:
            self.wait_until_hidden(notification_id)


class Addons(BaseLib):
    """With this class, an addon can be installed, enabled, disabled
    or removed. All actions required, such as opening `about:addons`,
    is done automatically.
    """

    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)

    @contextmanager
    def using_addon_list(self):
        about_addons = AboutAddonsTab(lambda: self.marionette)
        about_addons.open_tab()
        about_addons.set_category_by_id("extension")
        try:
            yield about_addons
        finally:
            about_addons.close_tab()

    @contextmanager
    def install_addon_in_two_steps(self, install_url):
        # open a new tab where the install URL will be opened
        install_tab = Windows(lambda: self.marionette).current.tabbar.open_tab()

        with self.marionette.using_context("content"):
            # open the install URL
            self.marionette.navigate(install_url)
            # open the first link
            self.marionette.find_element("tag name", "a").click()

        with self.marionette.using_context("chrome"):
            notif = _InstallNotifications(self.marionette)
            wait = Wait(self.marionette)

            with notif.wrap_lifetime("addon-install-blocked-notification"):
                # Allow the XPI to be downloaded.  ("allow" button)
                (
                    self.marionette
                    .find_element("id", "addon-install-blocked-notification")
                    .find_element("anon attribute", {"anonid": "button"})
                    .click()
                )

            with notif.wrap_lifetime("addon-install-confirmation-notification"):
                # Confirm installation.
                (
                    self.marionette
                    .find_element("id", "addon-install-confirmation-accept")
                    .click()
                )

            if install_tab.selected:
                # If the installation tab is still selected, the
                # "install complete" notification is shown.
                # If the selected tab has changed, there is no such
                # notification.

                with notif.wrap_lifetime("addon-install-complete-notification"):
                    # Close the "install complete" notification.
                    (
                        self.marionette
                        .find_element("id",
                                      "addon-install-complete-notification")
                        .find_element("anon attribute",
                                      {"anonid": "closebutton"})
                        .click()
                    )

        try:
            yield
        finally:
            install_tab.close()

    def install_addon(self, install_url):
        with self.install_addon_in_two_steps(install_url):
            pass

    def remove_addon_by_id(self, addon_id):
        with self.using_addon_list() as about_addons:
            addon = about_addons.get_addon_by_id(addon_id)
            about_addons.remove_addon(addon)

    def enable_addon_by_id(self, addon_id):
        with self.using_addon_list() as about_addons:
            addon = about_addons.get_addon_by_id(addon_id)
            about_addons.enable_addon(addon)

    def disable_addon_by_id(self, addon_id):
        with self.using_addon_list() as about_addons:
            addon = about_addons.get_addon_by_id(addon_id)
            about_addons.disable_addon(addon)


class AboutAddonsTab(BaseLib):
    """This class helps handling an `about:addons` tab.
    """

    def open_tab(self):
        self._tab = Windows(lambda: self.marionette).current.tabbar.open_tab()
        with self.marionette.using_context("content"):
            self.marionette.navigate("about:addons")

    def close_tab(self):
        with self.marionette.using_context("chrome"):
            if self._tab != None:
                self._tab.close()
                self._tab = None

    def set_category_by_id(self, category_id):
        with self.marionette.using_context("content"):
            (
                self.marionette
                .find_element("id", "category-" + category_id)
                .click()
            )

    def get_addon_by_id(self, addon_id):
        with self.marionette.using_context("content"):
            try:
                handle = (
                        self.marionette
                        .find_element("id", "list-view")
                        .find_element("css selector",
                                      ".addon[value='{}']".format(addon_id))
                    )
                return Addon(lambda: self.marionette, handle)
            except NoSuchElementException:
                return None

    def is_addon_installed(self, addon_id):
        # Switch categories to dispose of the undo link
        # which is displayed after clicking the "remove" button.
        self.set_category_by_id("theme")
        self.set_category_by_id("extension")

        return self.get_addon_by_id(addon_id) != None

    def enable_addon(self, addon):
        addon.click_enable()
        (
            Wait(self.marionette)
            .until(lambda m: addon.is_enabled(),
                   message="The addon has been enabled.")
        )

    def disable_addon(self, addon):
        addon.click_disable()
        (
            Wait(self.marionette)
            .until(lambda m: not addon.is_enabled(),
                   message="The addon has been disabled.")
        )

    def remove_addon(self, addon):
        if addon == None:
            # the addon does not exist
            return
        addon_id = addon.addon_id
        addon.click_remove()
        (
            Wait(self.marionette)
            .until(lambda m: not self.is_addon_installed(addon_id),
                   message="The addon has been uninstalled.")
        )


class Addon(BaseLib):
    def __init__(self, marionette_getter, addon_handle):
        BaseLib.__init__(self, marionette_getter)
        self._handle = addon_handle

    @property
    def addon_id(self):
        with self.marionette.using_context("content"):
            return self._handle.get_attribute("value")

    def is_enabled(self):
        with self.marionette.using_context("content"):
            return self._handle.get_attribute("active") == "true"

    def _click_on_button(self, button_name):
        with self.marionette.using_context("content"):
            (
                self._handle
                .find_element("anon attribute",
                              {"anonid": button_name + "-btn"})
                .click()
            )

    def click_enable(self):
        if not self.is_enabled():
            self._click_on_button("enable")

    def click_disable(self):
        if self.is_enabled():
            self._click_on_button("disable")

    def click_remove(self):
        self._click_on_button("remove")
