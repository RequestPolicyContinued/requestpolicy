# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class TestBeforeAllOtherTests(RequestPolicyTestCase):

    def test_gecko_log(self):
        error_lines = self.gecko_log.get_error_lines_before_first_test()
        if len(error_lines) != 0:
            self.fail(
                "Found " + str(len(error_lines)) + " error lines before " +
                "the first test! First error line: " + str(error_lines[0]))
