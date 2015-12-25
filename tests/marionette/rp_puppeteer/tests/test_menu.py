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
        def test(trigger):
            self.assertFalse(self.menu.is_open())
            self.menu.open(trigger=trigger)
            self.assertTrue(self.menu.is_open())
            self.menu.close()
            self.assertFalse(self.menu.is_open())

        test("api")
        test("button")
        test("shortcut")

    def test_total_num_requests(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("http://www.maindomain.test/img_1.html" +
                                     "?TestMenu.test_total_num_requests")
        self.menu.open()
        self.assertEqual(4, self.menu.total_num_requests)
