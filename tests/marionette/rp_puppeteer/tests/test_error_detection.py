# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.error_detection import (LoggingErrorDetection,
                                              ConsoleErrorDetection)


class TestErrorDetection(RequestPolicyTestCase):
    def test_logging_error_detection(self):
        error_detect = LoggingErrorDetection(lambda: self.marionette)

        previous_value = error_detect.n_errors

        self.assertIsNotNone(previous_value,
                             msg="The pref for the error count exists.")

        error_detect.trigger_error(
            "warning", msg="[Marionette] test_logging_error_detection")
        self.assertEqual(error_detect.n_errors, previous_value + 1,
                         msg="The error has been detected.")

        error_detect.trigger_error(
            "severe", msg="[Marionette] test_logging_error_detection")
        self.assertEqual(error_detect.n_errors, previous_value + 2,
                         msg="The severe log message has been detected.")

        error_detect.reset()
        self.assertEqual(error_detect.n_errors, 0,
                         msg="The Logging error count has been reset.")

    def test_console_error_detection(self):
        error_detect = ConsoleErrorDetection(lambda: self.marionette)

        self.assertEqual(error_detect.n_errors, 0,
                         msg="The Console error count is zero.")

        error_detect.trigger_error("ReferenceError")
        self.assertEqual(error_detect.n_errors, 1,
                         msg="The Console error count has increased.")

        error_detect.reset()
        self.assertEqual(error_detect.n_errors, 0,
                         msg="The Console error count has been reset.")
