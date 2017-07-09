# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.runners.base import FirefoxUITestRunner
from mozlog import get_default_logger
import time

from rp_puppeteer.api.gecko_log import GeckoLog


class RequestPolicyUITestRunner(FirefoxUITestRunner):

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
        gecko_log = GeckoLog(lambda: self.marionette)
        lines = gecko_log.get_lines_of_current_test()
        rv["gecko-log"] = "\n".join(lines)
        error_lines = gecko_log.get_error_lines_of_current_test()
        if len(error_lines) > 0:
            rv["detected-error-lines"] = "\n".join(error_lines)
