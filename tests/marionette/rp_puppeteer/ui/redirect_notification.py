# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from rp_puppeteer.api.l10n import L10n
from firefox_puppeteer.ui.windows import Windows
from rp_puppeteer.ui.tabs import Tabs
from marionette_driver.errors import NoSuchElementException
from marionette_driver.wait import Wait
import time


class RedirectNotification(BaseLib):
    # TODO: use notification bar class when bug 1139544 lands

    #################################
    # Public Properties and Methods #
    #################################

    def is_shown(self):
        """Check if the redirection notification bar is present."""

        # Wait some time to make sure the check happens not too early.
        # In that case `is_shown()` would return `False`, but it should
        # return `True`.
        # FIXME: Find a better solution than `sleep()`.
        time.sleep(0.1)

        try:
            self._panel
            return True
        except NoSuchElementException:
            return False

    def allow(self):
        """Allow the redirection."""

        self._allow_button.click()

        # Wait for the tab to load.
        # TODO: Bug 1140470: use replacement for mozmill's waitForPageLoad
        Wait(self.marionette).until(lambda _: not self.is_shown())
        win = Windows(lambda: self.marionette).current
        tab = win.tabbar.selected_tab
        Tabs(lambda: self.marionette).wait_until_loaded(tab)

    def close(self):
        """Close the notification bar."""

        self._close_button.click()
        # TODO: Bug 1140470: use replacement for mozmill's waitForPageLoad
        Wait(self.marionette).until(lambda _: not self.is_shown())

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _panel(self):
        """The redirection notification bar in the tab currently focused."""

        return (self.marionette.find_element("id", "content")
                .find_element("anon attribute", {"anonid": "tabbox"})
                .find_element("css selector",
                              "[value='request-policy-meta-redirect']"))

    @property
    def _allow_button(self):
        return self._panel.find_element("tag name", "button")

    @property
    def _close_button(self):
        return (
            self._panel
            .find_element("anon attribute",
                          {"class": "messageCloseButton close-icon tabbable"})
        )
