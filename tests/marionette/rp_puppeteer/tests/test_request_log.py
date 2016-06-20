# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
import time


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class RequestLogTestCase(RequestPolicyTestCase):

    def tearDown(self):
        try:
            if self.request_log.is_open():
                self.request_log.close()
        finally:
            super(RequestLogTestCase, self).tearDown()

    def _create_some_requests(self):
        with self.marionette.using_context("content"):
            self.marionette.navigate("http://www.maindomain.test/img_1.html")


class TestRequestLog(RequestLogTestCase):

    def test_open_close(self):
        self.assertFalse(self.request_log.is_open())
        self.request_log.open()
        self.assertTrue(self.request_log.is_open())
        self.request_log.close()
        self.assertFalse(self.request_log.is_open())

    def test_open_close_by_keyboard_shortcut(self):
        pref_prefix = ("extensions.requestpolicy."
                       "keyboardShortcuts.openRequestLog")
        self.prefs.set_pref(pref_prefix + ".combo", "control alt shift x")
        self.prefs.set_pref(pref_prefix + ".enabled", True)
        time.sleep(0.001)

        def press_shortcut():
            self.browser.send_shortcut("x", ctrl=True, alt=True, shift=True)

        self.assertFalse(self.request_log.is_open())
        self.request_log.open(trigger=press_shortcut)
        self.assertTrue(self.request_log.is_open())
        self.request_log.close(trigger=press_shortcut)
        self.assertFalse(self.request_log.is_open())

        self.prefs.reset_pref(pref_prefix + ".enabled")
        self.prefs.reset_pref(pref_prefix + ".combo")
        time.sleep(0.001)

    def test_clear(self):
        self.request_log.open()

        self._create_some_requests()

        with self.request_log.in_iframe():
            self.assertGreater(self.request_log.row_count, 0,
                               "The Request Log is not empty.")

        self.request_log.clear()

        with self.request_log.in_iframe():
            self.assertEqual(self.request_log.row_count, 0,
                             "The Request Log is empty.")


class TestGettingRequests(RequestLogTestCase):

    def setUp(self):
        super(TestGettingRequests, self).setUp()

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)
        self.request_log.open()
        self.request_log.clear()

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestGettingRequests, self).tearDown()

    def test_row_count_property(self):
        self._create_some_requests()

        with self.request_log.in_iframe():
            self.assertEqual(self.request_log.row_count,
                             len(self.request_log.rows))

    def test_compare_with_requests_api(self):
        # A test page with one allowed and one denied request.
        url = "http://www.maindomain.test/img_1.html"

        # Create some requests and record them with the Requests API.
        with self.requests.listen():
            with self.marionette.using_context("content"):
                self.marionette.navigate(url)

        api_requests = self.requests.all
        with self.request_log.in_iframe():
            ui_requests = self.request_log.rows
            row_count = self.request_log.row_count

        # Check the row count.
        self.assertEqual(len(ui_requests), row_count)
        self.assertEqual(len(api_requests), row_count)

        for i in range(row_count):
            # The orders of the two lists are vice versa.
            request = api_requests[i]
            row = ui_requests[row_count - i - 1]

            row_request = {"origin": row["origin"], "dest": row["dest"],
                           "isAllowed": row["isAllowed"]}

            self.assertEqual(row_request, request)
