# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.testcases import FirefoxTestCase
from rp_puppeteer import RequestPolicyPuppeteer


class RequestPolicyTestCase(RequestPolicyPuppeteer, FirefoxTestCase):
    """Base testcase class for RequestPolicy Marionette tests.

    Note: RequestPolicyPuppeteer must be the first base class
    in order to allow overriding the attributes of the `Puppeteer`
    class.
    """

    def __init__(self, *args, **kwargs):
        FirefoxTestCase.__init__(self, *args, **kwargs)

    #################################
    # Public Properties and Methods #
    #################################

    def tearDown(self, *args, **kwargs):
        try:
            self._check_and_fix_leaked_rules()
            self._check_and_fix_leaked_rules_in_rules_file()
            self._check_and_fix_ignoring_errors()
            self._check_gecko_log()
        finally:
            FirefoxTestCase.tearDown(self, *args, **kwargs)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _check_and_fix_leaked_rules(self):
        try:
            n_rules = self.rules.count_rules()
            self.assertEqual(n_rules, 0,
                             ("A test must not leak rules. Rule count is {}, "
                              "but should be zero."
                              ).format(n_rules))
        finally:
            self.rules.remove_all()

    def _check_and_fix_leaked_rules_in_rules_file(self):
        rules = self.rules_file.get_rules()
        n_rules = 0 if rules is None else len(rules)
        if n_rules != 0:
            self.rules.save()
            self.fail(("A test must not leak rules in the rules file. "
                       "Rule count is {} but should be zero."
                       ).format(n_rules))

    def _check_and_fix_ignoring_errors(self):
        ignoring = self.gecko_log.currently_ignoring_errors()
        if ignoring:
            self.gecko_log.stop_ignoring_errors()
        self.assertFalse(ignoring, msg="A test must stop ignoring errors on teardown.")


    def _check_gecko_log(self):
        error_lines = self.gecko_log.get_error_lines_of_current_test()
        if len(error_lines) != 0:
            for line in error_lines:
                print line
            self.fail("Found " + str(len(error_lines)) + " error lines! " +
                "First line: " + str(error_lines[0]))
