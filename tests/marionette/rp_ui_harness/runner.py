# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.runners.base import FirefoxUITestRunner
from mozlog import get_default_logger
import time
import ptvsd

from rp_puppeteer.api.gecko_log_parser import GeckoLogParser
from rp_ui_harness.decorators import lazyprop


class RequestPolicyUITestRunner(FirefoxUITestRunner):

    gecko_log_relpath = None
    _nth_test = 0

    def __init__(self, vscode_debug_secret=None,
                 vscode_debug_address=None, vscode_debug_port=None, **kwargs):
        if vscode_debug_secret is not None:
            ptvsd.enable_attach(
                vscode_debug_secret,
                address=(vscode_debug_address, int(vscode_debug_port))
            )
            print "Waiting for VS Code to attach"
            ptvsd.wait_for_attach()

        if kwargs["gecko_log"] is None:
            kwargs["gecko_log"] = ("logs/marionette.{}.gecko.log"
                                   ).format(int(time.time()))
        self.gecko_log_relpath = kwargs["gecko_log"]

        FirefoxUITestRunner.__init__(self, **kwargs)

        def gather_debug(test, status):
            rv = {}
            marionette = test._marionette_weakref()

            try:
                self._add_logging_info(rv)
            except Exception:
                logger = get_default_logger()
                logger.warning("Failed to gather test failure debug.",
                               exc_info=True)
            return rv

        self.result_callbacks.append(gather_debug)

    def run_test(self, *args, **kwargs):
        self._nth_test += 1
        super(RequestPolicyUITestRunner, self).run_test(*args, **kwargs)

    @lazyprop
    def _gecko_log_parser(self):
        return GeckoLogParser(self.gecko_log)

    def _add_logging_info(self, rv):
        parser = self._gecko_log_parser
        if self._nth_test == 1:
            lines = parser.get_all_lines()
            error_lines = parser.get_all_error_lines()
        else:
            lines = parser.get_lines_of_current_test()
            error_lines = parser.get_error_lines_of_current_test()
        rv["gecko-log"] = "\n".join(lines)
        if len(error_lines) > 0:
            rv["detected-error-lines"] = "\n".join(error_lines)
