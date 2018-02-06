# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import codecs
import re
from contextlib import contextmanager


known_bug_1 = (
    u"""[JavaScript Warning: "Expected end of value but found {0}10{1}.  """
    u"""Error in parsing value for {0}font-family{1}.  """
    u"""Declaration dropped." """
    u"""{2}file: "chrome://rpcontinued/skin/"""
)
WHITELIST = [
  # known bugs

  # Since Fx 49 (mercurial changeset 0af3c129a366), left and right
  # quotation marks are no longer <'>, but <\u2019> and <\u201A>.
  known_bug_1.format("'", "'", "{"),
  known_bug_1.format(u"\u2019", u"\u201A", "{"),
  re.compile(
      r"""^JavaScript strict warning: """
      r"""chrome://rpcontinued/content/lib/ruleset\.js, line [0-9]+: """
      r"""ReferenceError: reference to undefined property entryPart\.s"""
  ),

  # es5 targeting issues

  re.compile(
      # see https://github.com/Microsoft/TypeScript/issues/14868
      r"""JavaScript warning: """
      r"""chrome://rpcontinued/content/[^ ]+, line [0-9]+: """
      r"""mutating the \[\[Prototype\]\] of an object will cause your code """
      r"""to run very slowly; instead create the object with the correct """
      r"""initial \[\[Prototype\]\] value using Object\.create"""
  ),
  re.compile(
      # es6 generators
      r"""JavaScript strict warning: """
      r"""chrome://rpcontinued/content/[^ ]+, line [0-9]+: """
      r"""ReferenceError: reference to undefined property op\[1\]"""
  ),

  # other

  "[RequestPolicy] Warning:",
]

retype = type(re.compile(r"^"))


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

    # lines

    def get_all_lines(self):
        with self._gecko_log_file() as gecko_log:
            # Take all lines except the last one, which is empty.
            return gecko_log.read().split("\n")[:-1]

    def get_lines_before_first_test(self):
        lines = []
        for line in self.get_all_lines():
            if line.find("TEST-START") != -1:
                break
            lines.append(line)
        return lines

    def get_lines_of_current_test(self):
        all_lines = self.get_all_lines()
        lines = []
        for line in reversed(all_lines):
            lines.append(line)
            if line.find("TEST-START") != -1:
                break
        lines.reverse()
        return lines

    # error lines

    def get_all_error_lines(self, **kwargs):
        return self._filter_error_lines(self.get_all_lines(), **kwargs)

    def get_error_lines_of_current_test(self, **kwargs):
        return self._filter_error_lines(
            self.get_lines_of_current_test(), **kwargs)

    def get_error_lines_before_first_test(self, **kwargs):
        return self._filter_error_lines(
            self.get_lines_before_first_test(), **kwargs)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _filter_error_lines(self, lines,
                            return_ignored_as_well=False,
                            return_expected_as_well=True):
        error_lines = []
        ignore_helpers = []
        if not return_ignored_as_well:
            ignore_helpers.append(IgnoreHelper(
                self.IGNORE_ERRORS_START, self.IGNORE_ERRORS_END
            ))
        if not return_expected_as_well:
            ignore_helpers.append(IgnoreHelper(
                self.EXPECT_ERRORS_START, self.EXPECT_ERRORS_END
            ))
        prepend_to_next_line = ""
        for line in lines:
            line = prepend_to_next_line + line
            prepend_to_next_line = ""
            if re.match(r"^console.\w+:\s*$", line):
                prepend_to_next_line = line
                continue
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
        if re.match(r"^console\.(?!error)", line):
            return False
        for word in ["error", "warning", "exception"]:
            if line.find(word) != -1:
                return True
        return False

    def _is_rp_exception(self, line):
        if not self._is_exception(line):
            return False

        if (
            line.find("[RequestPolicy]") == -1 and
            line.find("chrome://rpcontinued/") == -1
        ):
            return False

        if line.find("/third-party/") != -1:
            return False

        for pattern in WHITELIST:
            if isinstance(pattern, retype):
                if pattern.match(line):
                    return False
            else:
                # string
                if line.find(pattern) == 0:
                    return False

        return True
