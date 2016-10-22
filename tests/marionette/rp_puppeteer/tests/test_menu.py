# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class TestMenu(RequestPolicyTestCase):

    def tearDown(self):
        try:
            self.menu.close()
        finally:
            super(RequestPolicyTestCase, self).tearDown()

    def test_open_close(self):
        def test(trigger, test_close=True):
            try:
                self.assertFalse(self.menu.is_open())
                self.menu.open(trigger=trigger)
                self.assertTrue(self.menu.is_open())
                if test_close:
                    self.menu.close(trigger=trigger)
                else:
                    self.menu.close()
                self.assertFalse(self.menu.is_open())
            except:
                print "trigger: " + trigger
                raise

        test("api")
        test("button")
        # The keyboard shortcut is not captured when the menu is open.
        test("shortcut", test_close=False)

    def test_total_num_requests(self):
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
