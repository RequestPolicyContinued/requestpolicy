# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.runners.base import FirefoxUITestRunner
from mozlog import get_default_logger

from rp_puppeteer.api.error_detection import (LoggingErrorDetection,
                                              ConsoleErrorDetection)


class RequestPolicyUITestRunner(FirefoxUITestRunner):

    def __init__(self, **kwargs):
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
            rv["Logging Errors"] = msg

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
            rv["console errors"] = msg
