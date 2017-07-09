# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import codecs
from contextlib import contextmanager


known_bug_1 = u"""[JavaScript Warning: "Expected end of value but found {0}10{1}.  Error in parsing value for {0}font-family{1}.  Declaration dropped." {2}file: "chrome://rpcontinued/skin/"""
WHITELIST = [
  # known bugs

  # Since Fx 49 (mercurial changeset 0af3c129a366), left and right
  # quotation marks are no longer <'>, but <\u2019> and <\u201A>.
  known_bug_1.format("'", "'", "{"),
  known_bug_1.format(u"\u2019", u"\u201A", "{"),
  """JavaScript strict warning: chrome://rpcontinued/content/lib/ruleset.jsm, line 151: ReferenceError: reference to undefined property entryPart.s""",

  # other

  "[RequestPolicy] Warning:",
]


class IgnoreHelper(object):

    def __init__(self, start_message, end_message):
        self.ignoring = False
        self.start_message = start_message
        self.end_message = end_message

    def update_and_check(self, line):
        if line == self.start_message:
            self.ignoring = True
            return True
        elif line == self.end_message:
            self.ignoring = False
            return True
        return self.ignoring


class GeckoLogParser(object):

    IGNORE_ERRORS_START = "[RP Puppeteer] GeckoLog ignore errors: start"
    IGNORE_ERRORS_END = "[RP Puppeteer] GeckoLog ignore errors: end"
    EXPECT_ERRORS_START = "[RP Puppeteer] GeckoLog expect errors: start"
    EXPECT_ERRORS_END = "[RP Puppeteer] GeckoLog expect errors: end"

    def __init__(self, gecko_log_path):
      self.path = gecko_log_path

    #################################
    # Public Properties and Methods #
    #################################

    def get_all_lines(self):
        with self._gecko_log_file() as gecko_log:
            # Take all lines except the last one, which is empty.
            return gecko_log.read().split("\n")[:-1]

    def get_all_error_lines(self, **kwargs):
        return self._filter_error_lines(self.get_all_lines(), **kwargs)

    def get_lines_of_current_test(self):
        all_lines = self.get_all_lines()
        lines = []
        for line in reversed(all_lines):
            lines.append(line)
            if line.find("TEST-START") != -1:
                break
        lines.reverse()
        return lines

    def get_error_lines_of_current_test(self, **kwargs):
        return self._filter_error_lines(self.get_lines_of_current_test(), **kwargs)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _filter_error_lines(self, lines,
            return_ignored_as_well=False,
            return_expected_as_well=True):
        error_lines = []
        ignore_helpers = []
        if not return_ignored_as_well:
            ignore_helpers.append(IgnoreHelper(self.IGNORE_ERRORS_START, self.IGNORE_ERRORS_END))
        if not return_expected_as_well:
            ignore_helpers.append(IgnoreHelper(self.EXPECT_ERRORS_START, self.EXPECT_ERRORS_END))
        for line in lines:
            ignoring = False
            for helper in ignore_helpers:
                if helper.update_and_check(line) is True:
                    ignoring = True
            if ignoring or not self._is_rp_exception(line):
                continue
            error_lines.append(line)
        return error_lines

    @contextmanager
    def _gecko_log_file(self):
        with codecs.open(self.path, "r", "utf-8") as file_obj:
            yield file_obj

    def _is_exception(self, line):
        line = line.lower()
        for word in ["error", "warning", "exception"]:
            if line.find(word) != -1:
                return True
        return False

    def _is_rp_exception(self, line):
        if not self._is_exception(line):
            return False

        if line.find("[RequestPolicy]") == -1 and line.find("chrome://rpcontinued/") == -1:
            return False

        if line.find("jquery.min.js") != -1:
            return False

        for known_bug in WHITELIST:
            if line.find(known_bug) == 0:
                return False

        return True
