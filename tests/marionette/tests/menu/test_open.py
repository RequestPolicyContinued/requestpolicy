# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette_driver.errors import TimeoutException
from marionette_driver.wait import Wait
import time
import unittest


class TestOpenMenu(RequestPolicyTestCase):

    ################
    # Test Methods #
    ################

    def test_shortcut_disabled(self):
        pref_name = ("extensions.requestpolicy."
                     "keyboardShortcuts.openMenu.enabled")
        self.prefs.set_pref(pref_name, False)
        time.sleep(0.001)

        self.assertFalse(self.menu.is_open())

        self._assert_menu_does_not_open(trigger="shortcut")
        self.assertFalse(self.menu.is_open())

        self.prefs.reset_pref(pref_name)
        time.sleep(0.001)

    @unittest.skip("self.browser.send_shortcut currently is buggy")
    def test_custom_shortcut_combo(self):
        pref_name = ("extensions.requestpolicy."
                     "keyboardShortcuts.openMenu.combo")
        self.prefs.set_pref(pref_name, "control alt shift x")
        time.sleep(0.001)

        def press_shortcut():
            self.browser.send_shortcut("x", ctrl=True, alt=True, shift=True)

        self.assertFalse(self.menu.is_open())
        # The default shortcut should not open the menu anymore
        self._assert_menu_does_not_open(trigger="shortcut")
        self.assertFalse(self.menu.is_open())
        # Test the custom combo
        self.menu.open(trigger=press_shortcut)
        self.assertTrue(self.menu.is_open())

        self.menu.close()
        self.prefs.reset_pref(pref_name)
        time.sleep(0.001)

    ##########################
    # Private Helper Methods #
    ##########################

    def _assert_menu_does_not_open(self, *args, **kwargs):
        def try_to_open(_):
            self.menu.open(*args, **kwargs)
            # Close the menu in case `open()` does _not_fail.
            self.menu.close()
        self._wait_until_raises(try_to_open, TimeoutException,
                                message="The menu should not open.")

    def _wait_until_raises(self, condition, exception, message=""):
        def until(*args, **kwargs):
            try:
                condition(*args, **kwargs)
                return False
            except exception:
                return True
        Wait(self.marionette).until(until, message=message)
