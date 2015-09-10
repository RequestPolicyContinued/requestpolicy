# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.api.keys import Keys
from marionette_driver.marionette import Actions
from marionette_driver.wait import Wait


class ContextMenu(BaseLib):
    def select_entry(self, entry_id, context_element):
        """Select a specific entry in the context menu of an HTMLElement.
        """

        menu = self.marionette.find_element("id", "contentAreaContextMenu")

        self._open(menu, context_element)
        self._click(menu, entry_id)
        self._close(menu)


    def _open(self, menu, context_element):
        """Open the context menu."""

        with self.marionette.using_context("content"):
            # right click on the HTML element
            Actions(self.marionette).click(context_element, 2).perform()

        self._wait_for_state(menu, "open")

        # FIXME: Sub-menus aren't currently supported. To support those,
        #        implement the Mozmill Controller's `_buildMenu()` function.
        #        It populates all submenus of the context menu recursively.
        #        Right now only top-level menu entries can be selected.


    def _click(self, menu, entry_id):
        """Click on an entry in the menu."""

        entry = menu.find_element("id", entry_id)
        Actions(self.marionette).click(entry).perform()


    def _close(self, menu):
        """Close the context menu."""

        # Only close if the menu is open. The menu for example closes itself
        # in case the URL in the current tab changes. Sending ESC to a menu
        # which is _not_ open anymore will cause the page load to stop.
        if menu.get_attribute("state") is "open":
            menu.send_keys(Keys.ESCAPE)
        self._wait_for_state(menu, "closed")


    def _wait_for_state(self, menu, state):
        Wait(self.marionette).until(
            lambda m: menu.get_attribute("state") == state,
            message="The menu's state is now '" + state + "'.")
