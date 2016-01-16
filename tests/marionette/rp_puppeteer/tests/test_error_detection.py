# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.error_detection import (LoggingErrorDetection,
                                              ConsoleErrorDetection)


class TestErrorDetection(RequestPolicyTestCase):

    def test_logging_error_detection(self):
        error_detect = LoggingErrorDetection(lambda: self.marionette)

        def assert_n_errors(n):
            self.assertEqual(n, error_detect.n_errors)
            self.assertEqual(n, len(error_detect.messages))

        assert_n_errors(0)

        error_detect.trigger_error(
            "warning", msg="[Marionette] test_logging_error_detection")
        assert_n_errors(1)

        error_detect.trigger_error(
            "severe", msg="[Marionette] test_logging_error_detection")
        assert_n_errors(2)

        error_detect.reset()
        assert_n_errors(0)

    def test_console_error_detection(self):
        error_detect = ConsoleErrorDetection(lambda: self.marionette)

        def assert_n_errors(n):
            self.assertEqual(n, error_detect.n_errors)
            self.assertEqual(n, len(error_detect.messages))

        assert_n_errors(0)

        error_detect.trigger_error("ReferenceError")
        assert_n_errors(1)

        error_detect.reset()
        assert_n_errors(0)
