# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette import expectedFailure
from marionette_driver import Wait
import re


msg = "[Marionette] test_logging_error_detection"
msg_regexp = "\[Marionette\] test_logging_error_detection"


class ErrorDetectionTests(object):

    ################
    # Test Methods #
    ################

    def test_normal_error(self, n=1):
        self.error_triggerer.trigger_error("error", "backgroundscript", msg=msg)
        self._do_checks(n, "^console.error:\s+\[RequestPolicy\] " + msg_regexp + "$")

    def test_reference_error(self, n=1):
        self.error_triggerer.trigger_error("ReferenceError", "backgroundscript")
        self._do_checks(n, "^JavaScript error: chrome://rpcontinued/content/ui-testing/services\.js, line [0-9]+: ReferenceError: ")

    ##########################
    # Private Helper Methods #
    ##########################

    def _do_checks(self, n, message_regexp):
        raise NotImplementedError


class ErrorDetectionTestCase(RequestPolicyTestCase):

    expected_error = False

    def setUp(self):
        super(ErrorDetectionTestCase, self).setUp()
        self.gecko_log.start_ignoring_errors(expected=self.expected_error)

    def tearDown(self):
        try:
            self.gecko_log.stop_ignoring_errors()
        finally:
            super(ErrorDetectionTestCase, self).tearDown()


class TestGeckoLog(ErrorDetectionTests, ErrorDetectionTestCase):

    def setUp(self):
        super(TestGeckoLog, self).setUp()

        self._assert_n_errors(0)

    ##########################
    # Private Helper Methods #
    ##########################

    def _do_checks(self, n, message_regexp):
        self._assert_n_errors(n)
        self._assert_error(message_regexp)

    def _get_error_lines_including_ignored_errors(self):
        return self.gecko_log.get_error_lines_of_current_test(
            return_ignored_as_well=True)

    def _get_error_lines(self):
        return self.gecko_log.get_error_lines_of_current_test()

    def _assert_n_errors(self, n):
        Wait(self.marionette).until(
            lambda _: len(self._get_error_lines_including_ignored_errors()) == n)
        self.assertEqual(0, len(self._get_error_lines()))

    def _assert_error(self, message_regexp):
        error_lines = self._get_error_lines_including_ignored_errors()
        line = error_lines[-1]
        self.assertTrue(re.search(message_regexp, line),
            msg=("String \"" + line + "\" matched!"))


class TestFailureOnTearDown(ErrorDetectionTests, ErrorDetectionTestCase):

    expected_error = True

    @expectedFailure
    def tearDown(self):
        super(TestFailureOnTearDown, self).tearDown()

    ##########################
    # Private Helper Methods #
    ##########################

    # Explicitly do *not* perform checks in _do_checks(), to test if the TestRunner's
    # tearDown fn waits long enough to detect all logging errors.

    def _do_checks(self, n, message_regexp):
        pass
