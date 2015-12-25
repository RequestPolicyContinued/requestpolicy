# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette_driver.errors import TimeoutException
import time


class TestOpenMenu(RequestPolicyTestCase):

    def test_shortcut_disabled(self):
        pref_name = ("extensions.requestpolicy."
                     "keyboardShortcuts.openMenu.enabled")
        self.prefs.set_pref(pref_name, False)
        time.sleep(0.001)

        self.assertFalse(self.menu.is_open())
        with self.assertRaises(TimeoutException):
            self.menu.open(trigger="shortcut")
        self.assertFalse(self.menu.is_open())

        self.prefs.reset_pref(pref_name)
        time.sleep(0.001)

    def test_custom_shortcut_combo(self):
        pref_name = ("extensions.requestpolicy."
                     "keyboardShortcuts.openMenu.combo")
        self.prefs.set_pref(pref_name, "control alt shift x")
        time.sleep(0.001)

        def press_shortcut():
            self.browser.send_shortcut("x", ctrl=True, alt=True, shift=True)

        self.assertFalse(self.menu.is_open())
        # The default shortcut should not open the menu anymore
        with self.assertRaises(TimeoutException):
            self.menu.open(trigger="shortcut")
        self.assertFalse(self.menu.is_open())
        # Test the custom combo
        self.menu.open(trigger=press_shortcut)
        self.assertTrue(self.menu.is_open())

        self.menu.close()
        self.prefs.reset_pref(pref_name)
        time.sleep(0.001)
