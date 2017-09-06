# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from marionette_driver.wait import Wait
from .gecko_log_parser import GeckoLogParser


class GeckoLog(BaseLib, GeckoLogParser):

    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)
        GeckoLogParser.__init__(self, self.marionette.instance.gecko_log)

    def find(self, strings, min_line=0):
        all_lines = self.get_all_lines()
        for i in range(len(all_lines) - 1, min_line - 1, -1):
            line = all_lines[i]
            for s in strings:
                if line == s:
                    return s
        return None

    def currently_ignoring_errors(self):
        return self._current_ignore_type() is not None

    def start_ignoring_errors(self, expected=False):
        assert self.currently_ignoring_errors() is False
        msg = (self.IGNORE_ERRORS_START if not expected
               else self.EXPECT_ERRORS_START)
        self.dump_and_wait(msg)

    def stop_ignoring_errors(self):
        current_type = self._current_ignore_type()
        assert current_type is not None
        is_expect = current_type == "expect"
        msg = (self.IGNORE_ERRORS_END if not is_expect
               else self.EXPECT_ERRORS_END)
        self.dump_and_wait(msg)

    def dump_and_wait(self, message):
        min_line = len(self.get_all_lines())
        self.marionette.execute_script("""
          Components.utils.import("resource://gre/modules/Services.jsm");
          Services.obs.notifyObservers(null, "{}", "{}");
        """.format("requestpolicy-dump-string", message))
        Wait(self.marionette).until(
            lambda _: self.find([message], min_line=min_line) == message)

    def _current_ignore_type(self):
        last_ignore = self.find([
            self.IGNORE_ERRORS_START,
            self.IGNORE_ERRORS_END
        ])
        if last_ignore is not None and last_ignore == self.IGNORE_ERRORS_START:
            return "ignore"
        last_expect = self.find([
            self.EXPECT_ERRORS_START,
            self.EXPECT_ERRORS_END
        ])
        if last_expect is not None and last_expect == self.EXPECT_ERRORS_START:
            return "expect"
        return None
