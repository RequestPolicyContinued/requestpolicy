# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib


class ErrorTriggerer(BaseLib):

    def _notify_observers(self, topic, data):
        self.marionette.execute_script("""
          Components.utils.import("resource://gre/modules/Services.jsm");
          Services.obs.notifyObservers(null, "{}", "{}");
        """.format(topic, data))

    def trigger_error(self, error_type, msg="[Marionette unit test]"):
        self._notify_observers("requestpolicy-trigger-error",
                               "{}:{}".format(error_type, msg))
