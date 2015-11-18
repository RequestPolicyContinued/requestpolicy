# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.testcases import FirefoxTestCase
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

    #################################
    # Public Properties and Methods #
    #################################

    def setUp(self, *args, **kwargs):
        FirefoxTestCase.setUp(self, *args, **kwargs)

        marionette_getter = lambda: self.marionette
        self.logging_error_detect = LoggingErrorDetection(marionette_getter)
        self.console_error_detect = ConsoleErrorDetection(marionette_getter)

        self._check_and_reset_error_counts()

    def tearDown(self, *args, **kwargs):
        try:
            self._check_and_fix_leaked_rules()
            self._check_and_fix_leaked_rules_in_rules_file()
            self._check_and_reset_error_counts()
        finally:
            FirefoxTestCase.tearDown(self, *args, **kwargs)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _check_and_fix_leaked_rules(self):
        try:
            n_rules = self.rules.count_rules()
            self.assertEqual(n_rules, 0,
                             "A test must not leak rules. Rule count is {}, "
                             "but should be zero.".format(n_rules))
        finally:
            self.rules.remove_all()

    def _check_and_fix_leaked_rules_in_rules_file(self):
        rules = self.rules_file.get_rules()
        n_rules = 0 if rules is None else len(rules)
        if n_rules != 0:
            self.rules.save()
            self.fail("A test must not leak rules in the rules file. "
                      "Rule count is {} but should be zero.".format(n_rules))

    def _check_and_reset_error_counts(self):
        try:
            self.assertEqual(self.logging_error_detect.n_errors, 0,
                             "There should be no logging errers.")
            self.assertEqual(self.console_error_detect.n_errors, 0,
                             "There should be no console errors. "
                             "Messages were: {}"
                             .format(self.console_error_detect.messages))
        finally:
            self.logging_error_detect.reset()
            self.console_error_detect.reset()
