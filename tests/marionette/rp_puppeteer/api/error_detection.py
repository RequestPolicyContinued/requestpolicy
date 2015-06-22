# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.api.prefs import Preferences

ERROR_COUNT_PREF = "extensions.requestpolicy.unitTesting.errorCount"


class ErrorDetection(BaseLib):
    def _notify_observers(self, topic, data):
        with self.marionette.using_context("chrome"):
            self.marionette.execute_script(
                """
                Components.utils.import("resource://gre/modules/Services.jsm");
                Services.obs.notifyObservers(null, "{}", "{}");
                """.format(topic, data))

    def get_error_count(self):
        raise NotImplementedError

    def reset_error_count(self):
        raise NotImplementedError

    def trigger_error(self):
        raise NotImplementedError


class LoggingErrorDetection(ErrorDetection):
    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)

        self.prefs = Preferences(marionette_getter)

    def get_error_count(self):
        return self.prefs.get_pref(ERROR_COUNT_PREF)

    def reset_error_count(self):
        self.prefs.set_pref(ERROR_COUNT_PREF, 0)

    def trigger_error(self, error_type, msg="[Marionette unit test]"):
        self._notify_observers("requestpolicy-trigger-logging-error",
                               "{}:{}".format(error_type, msg))


class ConsoleErrorDetection(ErrorDetection):
    def get_error_count(self):
        with self.marionette.using_context("chrome"):
            return self.marionette.execute_script(
                """
                let scope = {};
                Components.utils.import("chrome://rpc-dev-helper/" +
                    "content/console-observer.jsm", scope);
                return scope.ConsoleObserver.getNumErrors();
                """)

    def reset_error_count(self):
        with self.marionette.using_context("chrome"):
            return self.marionette.execute_script(
                """
                let scope = {};
                Components.utils.import("chrome://rpc-dev-helper/content/" +
                    "console-observer.jsm", scope);
                scope.ConsoleObserver.reset();
                """)

    def trigger_error(self, error_type):
        self._notify_observers("requestpolicy-trigger-console-error",
                               error_type)
