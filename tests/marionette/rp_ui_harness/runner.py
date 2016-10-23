# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.runners.base import FirefoxUITestRunner
from mozlog import get_default_logger
import time
import os
import codecs
from contextlib import contextmanager

from rp_puppeteer.api.error_detection import (LoggingErrorDetection,
                                              ConsoleErrorDetection)


class RequestPolicyUITestRunner(FirefoxUITestRunner):

    next_gecko_log_starting_line = 1
    gecko_log_relpath = None

    def __init__(self, **kwargs):
        if kwargs["gecko_log"] is None:
            kwargs["gecko_log"] = ("logs/marionette.{}.gecko.log"
                                   ).format(int(time.time()))
        self.gecko_log_relpath = kwargs["gecko_log"]

        FirefoxUITestRunner.__init__(self, **kwargs)

        def gather_debug(test, status):
            rv = {}
            marionette = test._marionette_weakref()

            if marionette.session is not None:
                try:
                    self._add_logging_info(rv, marionette)
                except Exception:
                    logger = get_default_logger()
                    logger.warning("Failed to gather test failure debug.",
                                   exc_info=True)
            return rv

        self.result_callbacks.append(gather_debug)

    def _add_logging_info(self, rv, marionette):
        m_getter = lambda: self.marionette
        logging_error_detect = LoggingErrorDetection(m_getter)
        console_error_detect = ConsoleErrorDetection(m_getter)

        n_logging_errors = logging_error_detect.n_errors
        logging_errors = logging_error_detect.messages
        if n_logging_errors > 0:
            msg = ""
            n_diff = n_logging_errors - len(logging_errors)
            if n_diff != 0:
                msg += ("There are actually {} more logging erros "
                        "than displayed here!\n\n"
                        ).format(n_diff)
            msg += "\n\n".join(logging_errors)
            rv["Logging Errors"] = self._plaintext_to_html(msg)

        n_console_errors = console_error_detect.n_errors
        console_errors = console_error_detect.messages
        if n_console_errors > 0:
            msg = ""
            n_diff = n_console_errors - len(console_errors)
            if n_diff != 0:
                msg += ("There are actually {} more console erros "
                        "than displayed here!\n\n"
                        ).format(n_diff)
            msg += "\n".join(console_errors)
            rv["console errors"] = self._plaintext_to_html(msg)

        with self._gecko_log_file() as gecko_log:
            msg = ""
            # Take all lines except the last one, which is empty.
            lines = gecko_log.read().split("\n")[:-1]
            first_line = self.next_gecko_log_starting_line
            last_line = len(lines)
            self.next_gecko_log_starting_line = last_line + 1
            msg += "Lines {}-{}:\n\n".format(first_line, last_line)

            less_lines = lines[(first_line - 1):]
            msg += "\n".join(less_lines)
            rv["gecko-log"] = self._plaintext_to_html(msg)

    @contextmanager
    def _gecko_log_file(self):
        abspath = os.path.abspath(self.gecko_log_relpath)
        with codecs.open(abspath, "r", "utf-8") as file_obj:
            yield file_obj

    def _plaintext_to_html(self, text):
        text_escaped = text.replace("<", "&lt;").replace(">", "&gt;")

        return u"<pre>{}</pre>".format(text_escaped)
