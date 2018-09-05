# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette import SkipTest


class MenuTestCase(RequestPolicyTestCase):

    def tearDown(self):
        try:
            if not self.disabled:
                self.menu.close()
        finally:
            super(RequestPolicyTestCase, self).tearDown()

    @property
    def disabled(self):
        return not self.menu.is_working

    @property
    def skip_if_disabled(self):
        if self.disabled:
            raise SkipTest("menu is defunct")


# ==============================================================================


class MenuTests:
    class TriggeringMenuTests(MenuTestCase):
        trigger = None
        test_close = True

        def test_open_close(self):
            self.skip_if_disabled()

            try:
                self.assertFalse(self.menu.is_open())
                self.menu.open(trigger=self.trigger)
                self.assertTrue(self.menu.is_open())
                if self.test_close:
                    self.menu.close(trigger=self.trigger)
                else:
                    self.menu.close()
                self.assertFalse(self.menu.is_open())
            except:  # noqa
                print "trigger: " + self.trigger
                raise


class TestTriggeringMenuViaApi(MenuTests.TriggeringMenuTests):
    trigger = "api"


class TestTriggeringMenuViaButton(MenuTests.TriggeringMenuTests):
    trigger = "button"


class TestTriggeringMenuViaShortcut(MenuTests.TriggeringMenuTests):
    trigger = "shortcut"
    # The keyboard shortcut is not captured when the menu is open.
    test_close = False


# ------------------------------------------------------------------------------


class TestMenu(MenuTestCase):
    def test_total_num_requests(self):
        self.skip_if_disabled()

        with self.requests.listen():
            with self.marionette.using_context("content"):
                self.marionette.navigate(
                    "http://www.maindomain.test/img_1.html" +
                    "?TestMenu.test_total_num_requests")
        expected_num_requests = 0
        for request in self.requests.all:
            if request["origin"].startswith("http://www.maindomain.test/"):
                expected_num_requests += 1
        self.menu.open()
        self.assertEqual(expected_num_requests, self.menu.total_num_requests)
