# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib


class ErrorDetection(BaseLib):

    def _notify_observers(self, topic, data):
        self.marionette.execute_script("""
          Components.utils.import("resource://gre/modules/Services.jsm");
          Services.obs.notifyObservers(null, "{}", "{}");
        """.format(topic, data))

    def _call(self):
        raise NotImplementedError

    @property
    def n_errors(self):
        return self._call("getNumErrors")

    @property
    def messages(self):
        return self._call("getMessages")

    def reset(self):
        self._call("reset")

    def trigger_error(self):
        raise NotImplementedError


class LoggingErrorDetection(ErrorDetection):

    def _call(self, fn_name):
        return self.marionette.execute_script("""
          let fnName = arguments[0];
          let {LoggingObserver} = Components.utils.import(
              "chrome://rpc-dev-helper/content/logging-observer.jsm", {});
          return LoggingObserver[fnName]();
        """, script_args=[fn_name])

    def trigger_error(self, error_type, msg="[Marionette unit test]"):
        self._notify_observers("requestpolicy-trigger-logging-error",
                               "{}:{}".format(error_type, msg))


class ConsoleErrorDetection(ErrorDetection):

    def _call(self, fn_name):
        return self.marionette.execute_script("""
          let fnName = arguments[0];
          let {ConsoleObserver} = Components.utils.import(
              "chrome://rpc-dev-helper/content/console-observer.jsm", {});
          return ConsoleObserver[fnName]();
        """, script_args=[fn_name])

    def trigger_error(self, error_type):
        self._notify_observers("requestpolicy-trigger-console-error",
                               error_type)
