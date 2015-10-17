# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.requests import Requests


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestRequestObserver(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)

        self.sandbox_1 = "test_requests_1"
        self.sandbox_2 = "test_requests_2"

    def test_listening(self):
        """Test that `listening` returns correct values."""

        self.assertFalse(self.requests.listening)
        # start to listen
        self.requests.start_listening()
        self.assertTrue(self.requests.listening)
        # stop listening
        self.requests.stop_listening()
        self.assertFalse(self.requests.listening)

    def test_start_stop_multiple_times(self):
        self.assertFalse(self.requests.listening)

        self.requests.start_listening()
        self.assertTrue(self.requests.listening)
        self.requests.start_listening()
        self.assertTrue(self.requests.listening)

        self.requests.stop_listening()
        self.assertFalse(self.requests.listening)
        self.requests.stop_listening()
        self.assertFalse(self.requests.listening)

    def test_start_stop_multiple_instances(self):
        requests_1 = Requests(lambda: self.marionette)
        requests_2 = Requests(lambda: self.marionette)
        self.assertFalse(requests_1.listening)
        self.assertFalse(requests_2.listening)

        requests_1.start_listening()
        self.assertTrue(requests_1.listening)
        self.assertTrue(requests_2.listening)

        requests_2.stop_listening()
        self.assertFalse(requests_1.listening)
        self.assertFalse(requests_2.listening)

    def test_listen(self):
        self.assertFalse(self.requests.listening)
        with self.requests.listen():
            self.assertTrue(self.requests.listening)
        self.assertFalse(self.requests.listening)

    def test_custom_sandbox(self):
        """Test that an independent sandbox can be specified."""

        requests_1 = Requests(lambda: self.marionette, sandbox=self.sandbox_1)
        requests_2 = Requests(lambda: self.marionette, sandbox=self.sandbox_2)
        self.assertFalse(requests_1.listening)
        self.assertFalse(requests_2.listening)

        requests_1.start_listening()
        self.assertTrue(requests_1.listening)
        self.assertFalse(requests_2.listening)

        requests_2.start_listening()
        self.assertTrue(requests_1.listening)
        self.assertTrue(requests_2.listening)

        requests_1.stop_listening()
        self.assertFalse(requests_1.listening)
        self.assertTrue(requests_2.listening)

        requests_2.stop_listening()
        self.assertFalse(requests_1.listening)
        self.assertFalse(requests_2.listening)

    def test_stop_on_deletion(self):
        """Test that the listener is stopped when the object gets removed."""

        requests_1 = Requests(lambda: self.marionette, sandbox=self.sandbox_1)
        requests_1.start_listening()
        self.assertTrue(requests_1.listening)
        # Reset variable.
        requests_1 = None

        requests_2 = Requests(lambda: self.marionette, sandbox=self.sandbox_1)
        self.assertFalse(requests_2.listening)


    def test_clear(self):
        self.assertFalse(self.requests.listening)
        self.requests.start_listening()
        self.assertTrue(self.requests.listening)

        # produce some requests
        with self.marionette.using_context("content"):
            self.marionette.navigate("http://www.maindomain.test/")
        self.assertNotEqual(len(self.requests.all), 0,
                            "The list of requests is not empty.")

        self.requests.clear()
        self.assertEqual(len(self.requests.all), 0,
                         "The list of requests is empty.")
        self.assertTrue(self.requests.listening, "Still listening.")

        # clean up
        self.requests.stop_listening()

    def test_cleanup_sandbox(self):
        """Test cleaning up a sandbox removes old values."""

        def set_foo():
            self.marionette.execute_script("""
              this.foo = 1;
            """, sandbox=self.requests.sandbox)

        def typeof_foo():
            return self.marionette.execute_script("""
              return typeof this.foo;
            """, sandbox=self.requests.sandbox, new_sandbox=False)

        # Set foo.
        set_foo()

        self.assertEqual(typeof_foo(), "number",
                         msg="Variable `foo` should exist.")

        self.requests.cleanup_sandbox()

        self.assertEqual(typeof_foo(), "undefined",
                         msg="Variable `foo` should not exist.")


class TestGettingRequests(RequestPolicyTestCase):
    """Class for testing `Requests.all`."""

    def setUp(self):
        RequestPolicyTestCase.setUp(self)

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)
        self.requests.start_listening()

    def tearDown(self):
        self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        self.requests.stop_listening()

    def test_empty_sandbox(self):
        self.requests.cleanup_sandbox()
        self.assertIsNone(self.requests.all)

    def test_allowed_denied(self):
        """Test a page with one allowed and one denied request."""

        with self.marionette.using_context("content"):
            self.marionette.navigate("http://www.maindomain.test/img_1.html")

        # Obligatory requests.
        expected_requests = [
            {
                "origin": "chrome://browser/content/browser.xul",
                "dest": "http://www.maindomain.test/img_1.html",
                "isAllowed": True
            },
            {
                "origin": "http://www.maindomain.test/img_1.html",
                "dest": "http://www.maindomain.test/same-site-image.png",
                "isAllowed": True
            }, {
                "origin": "http://www.maindomain.test/img_1.html",
                "dest": "http://www.otherdomain.test/cross-site-image.png",
                "isAllowed": False
            }
        ]

        # Requests that are recorded _sometimes_.
        possible_additional_requests = [
            {
                # The favicon is only loaded if it's the first load of
                # the domain.
                "origin": "http://www.maindomain.test/favicon.ico",
                "dest": "http://www.otherdomain.test/subdirectory/flag-gray.png",
                "isAllowed": False
            }
        ]

        # Get all recorded requests.
        requests = self.requests.all

        # Filter out "possible additional requests".
        requests = filter(lambda r: r not in possible_additional_requests,
                          requests)

        self.assertGreaterEqual(len(requests), len(expected_requests))

        for expected_request in expected_requests:
            len_before = len(requests)
            # filter out the expected request
            requests = filter(lambda r: r != expected_request, requests)
            self.assertLess(len(requests), len_before,
                            ("Some requests matched expected request {}."
                             .format(str(expected_request))))

        self.assertEqual(len(requests), 0,
                         ("All requests should have been filtered out, so "
                          "`requests` should be empty: {}".format(requests)))
