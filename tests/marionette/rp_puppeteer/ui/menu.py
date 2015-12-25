# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.ui.windows import Windows
from marionette_driver.wait import Wait
import re


class Menu(BaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def total_num_requests(self):
        label_element = self._popup.find_element("id", "rpc-origin-num-requests")
        text = label_element.get_attribute("value")
        match = re.match(r"^(\d+) \((\d+)\+(\d+)\)$", text)
        return int(match.group(1))

    def open(self, trigger="api"):
        if trigger == "button":
            self._toolbar_button.click()
            Wait(self.marionette).until(lambda _: self._popup_state == "open")
        elif trigger == "shortcut":
            window = Windows(lambda: self.marionette).current
            window.send_shortcut("r", alt=True, shift=True)
            Wait(self.marionette).until(lambda _: self._popup_state == "open")
        elif trigger == "api":
            self._ensure_popup_state("open")
        else:
            raise ValueError("Unknown opening method: \"{}\"".format(trigger))

    def is_open(self):
        return self._popup_state == "open"

    def close(self):
        self._ensure_popup_state("closed")

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _toolbar_button(self):
        return self.marionette.find_element("id", "rpcontinuedToolbarButton")

    @property
    def _popup(self):
        return self.marionette.find_element("id", "rpc-popup")

    @property
    def _popup_state(self):
        return self._popup.get_attribute("state")

    def _ensure_popup_state(self, state):
        assert state in ["open", "closed"]

        if self._popup_state == state:
            return

        fn_name = "openPopup" if state == "open" else "hidePopup"

        self.marionette.execute_script("""
          let popup = arguments[0];
          let fnName = arguments[1];
          popup[fnName]();
        """, script_args=[self._popup, fn_name])

        Wait(self.marionette).until(lambda _: self._popup_state == state)
