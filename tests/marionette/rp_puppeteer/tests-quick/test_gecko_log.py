# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class ErrorIgnoringTests(object):

    expected_error = False

    def test_start_stop(self):
        self.assertFalse(self.gecko_log.currently_ignoring_errors())
        self.gecko_log.start_ignoring_errors(expected=self.expected_error)
        self.assertTrue(self.gecko_log.currently_ignoring_errors())
        self.gecko_log.stop_ignoring_errors()
        self.assertFalse(self.gecko_log.currently_ignoring_errors())


class TestIgnoringErrors(ErrorIgnoringTests, RequestPolicyTestCase):
    pass


class TestIgnoringExpectedErrors(ErrorIgnoringTests, RequestPolicyTestCase):
    expected_error = True
