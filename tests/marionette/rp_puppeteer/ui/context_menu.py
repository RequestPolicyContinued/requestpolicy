# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.api.keys import Keys
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils
from marionette_driver.marionette import Actions
from marionette_driver.wait import Wait
from rp_puppeteer.errors import ElementNotDisplayedException


class ContextMenu(BaseLib):

    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)

        self.app_info = AppInfo(marionette_getter)
        self.utils = Utils(marionette_getter)

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def element(self):
        return self.marionette.find_element("id", "contentAreaContextMenu")

    @property
    def state(self):
        if self.utils.compare_version(self.app_info.version, "49") < 0:
            # up to Firefox 48 (Bug 1272653)
            return self.element.get_attribute("state")
        return self.element.get_property("state")

    def select_entry(self, entry_id, context_element):
        """Select a specific entry in the context menu of an HTMLElement."""

        self._open(context_element)
        try:
            self._click(entry_id)
        finally:
            # The context menu should always be closed.
            self._close()

    ##################################
    # Private Properties and Methods #
    ##################################

    def _open(self, context_element):
        """Open the context menu."""

        with self.marionette.using_context("content"):
            # right click on the HTML element
            Actions(self.marionette).click(context_element, 2).perform()

        self._wait_for_state("open")

        # FIXME: Sub-menus aren't currently supported. To support those,
        #        implement the Mozmill Controller's `_buildMenu()` function.
        #        It populates all submenus of the context menu recursively.
        #        Right now only top-level menu entries can be selected.

    def _click(self, entry_id):
        """Click on an entry in the menu."""

        def is_displayed(entry):
            rect = entry.rect
            return rect["width"] > 0 and rect["height"] > 0

        entry = self.element.find_element("id", entry_id)
        if is_displayed(entry):
            entry.click()
        else:
            raise ElementNotDisplayedException

    def _close(self):
        """Close the context menu."""

        # Only close if the menu is open. The menu for example closes itself
        # in case the URL in the current tab changes. Sending ESC to a menu
        # which is _not_ open anymore will cause the page load to stop.
        if self.state == "open":
            self.element.send_keys(Keys.ESCAPE)
        self._wait_for_state("closed")

    def _wait_for_state(self, state):
        Wait(self.marionette).until(
            lambda _: self.state == state,
            message="The menu's state is now '{}'.".format(state))
