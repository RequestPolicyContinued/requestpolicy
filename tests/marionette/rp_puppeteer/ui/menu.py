# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils
from firefox_puppeteer.ui.windows import Windows
from marionette_driver.wait import Wait
from contextlib import contextmanager
import re


class Menu(BaseLib):
    is_working = False  # menu.open() fails due to a TimeoutException

    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)

        self.app_info = AppInfo(marionette_getter)
        self.utils = Utils(marionette_getter)

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def total_num_requests(self):
        label_element = self.marionette.find_element(
            "id", "rpc-origin-num-requests")
        if self.utils.compare_version(self.app_info.version, "49") < 0:
            # up to Firefox 48 (Bug 1272653)
            text = label_element.get_attribute("value")
        else:
            text = label_element.get_property("value")
        match = re.match(r"^(\d+) \((\d+)\+(\d+)\)$", text)
        return int(match.group(1))

    def open(self, trigger="api"):
        if self.is_open():
            return
        self._toggle(trigger=trigger)

    def is_open(self):
        return self._popup_state == "open"

    def close(self, trigger="api"):
        if not self.is_open():
            return
        self._toggle(trigger=trigger)

    @property
    def preferences_button(self):
        return self.marionette.find_element("id", "rpc-link-prefs")

    @property
    def manage_policies_button(self):
        return self.marionette.find_element("id", "rpc-link-policies")

    def switch_to_iframe(self):
        self.marionette.switch_to_frame(self._iframe)

    @contextmanager
    def in_iframe(self):
        frame = self.marionette.get_active_frame()
        self.switch_to_iframe()
        yield
        self.marionette.switch_to_frame(frame)

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
    def _iframe(self):
        return self.marionette.find_element("id", "rpc-popup-frame")

    @property
    def _popup_state(self):
        if self.utils.compare_version(self.app_info.version, "49") < 0:
            # up to Firefox 48 (Bug 1272653)
            return self._popup.get_attribute("state")
        return self._popup.get_property("state")

    def _toggle(self, trigger="api"):
        is_open = self.is_open()
        target_popup_state = "closed" if is_open else "open"

        if callable(trigger):
            trigger()
        elif trigger == "button":
            self._toolbar_button.click()
        elif trigger == "shortcut":
            window = Windows(lambda: self.marionette).current
            window.send_shortcut("r", alt=True, shift=True)
        elif trigger == "api":
            self._ensure_popup_state(target_popup_state)
        else:
            raise ValueError("Unknown trigger method: \"{}\"".format(trigger))

        if target_popup_state == "open":
            # Briefly enter the iframe to make sure the it's loaded.
            with self.in_iframe():
                pass

        (
            Wait(self.marionette, timeout=1)
            .until(lambda _: self.is_open() is not is_open)
        )

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
