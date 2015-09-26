# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness import FirefoxTestCase
from rp_puppeteer import RequestPolicyPuppeteer

from rp_puppeteer.api.error_detection import (LoggingErrorDetection,
                                              ConsoleErrorDetection)


class RequestPolicyTestCase(RequestPolicyPuppeteer, FirefoxTestCase):
    """Base testcase class for RequestPolicy Marionette tests.

    Note: RequestPolicyPuppeteer must be the first base class
    in order to allow overriding the attributes of the `Puppeteer`
    class.
    """

    def __init__(self, *args, **kwargs):
        FirefoxTestCase.__init__(self, *args, **kwargs)


    def _check_error_counts(self):
        self.assertEqual(self.logging_error_detect.get_error_count(), 0,
                         msg="The Logging error count is zero.")
        self.assertEqual(self.console_error_detect.get_error_count(), 0,
                         msg="The Console error count is zero.")

    def _reset_error_counts(self):
        self.logging_error_detect.reset_error_count()
        self.console_error_detect.reset_error_count()

    def _check_and_reset_error_counts(self):
        try:
            self._check_error_counts()
        finally:
            self._reset_error_counts()


    def setUp(self, *args, **kwargs):
        FirefoxTestCase.setUp(self, *args, **kwargs)

        marionette_getter = lambda: self.marionette
        self.logging_error_detect = LoggingErrorDetection(marionette_getter)
        self.console_error_detect = ConsoleErrorDetection(marionette_getter)

        self._check_and_reset_error_counts()

    def tearDown(self, *args, **kwargs):
        try:
            self._check_and_reset_error_counts()
        finally:
            FirefoxTestCase.tearDown(self, *args, **kwargs)
