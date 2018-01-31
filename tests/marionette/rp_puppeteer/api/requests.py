# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from contextlib import contextmanager


GET_BACKGROUND_PAGE = """
    Components.utils.
        import("chrome://rpcontinued/content/bootstrap/bootstrap.jsm", {}).
        FakeWebExt.Api.browser.extension.getBackgroundPage()
"""


class Requests(BaseLib):
    """Class for observing requests."""

    def __init__(self, marionette_getter, sandbox="default"):
        super(Requests, self).__init__(marionette_getter)
        self._sandbox = "requestpolicy-requests-" + sandbox

    def __del__(self):
        self.stop_listening()
        self.cleanup_sandbox()

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def all(self):
        return self.marionette.execute_script("""
          if (typeof this.requestObserver !== "object") {
            return null;
          }
          return this.requestObserver.requests;
        """, sandbox=self._sandbox, new_sandbox=False)

    @property
    def listening(self):
        """Whether or not requests are currently observed."""

        return self.marionette.execute_script("""
          return (typeof this.listening === "boolean" &&
                  this.listening === true);
        """, sandbox=self._sandbox, new_sandbox=False)

    @property
    def sandbox(self):
        return self._sandbox

    def start_listening(self):
        """Start observing requests."""

        self.continue_listening()
        self.clear()

    def continue_listening(self):
        """Start observing requests without clearing the requests."""

        # Already listening?
        if self.listening:
            return

        return self.marionette.execute_script("""
          const {Requests} = """ + GET_BACKGROUND_PAGE + """;

          this.requestObserver = (function (self) {
            self.requests = self.requests || [];
            self.pushRequest = function({
                isAllowed: aIsAllowed,
                originUri: aOriginUri,
                destUri: aDestUri,
                requestResult: aRequestResult,
            }) {
              self.requests.push({
                origin: aOriginUri,
                dest: aDestUri,
                isAllowed: aIsAllowed
              });
            };
            self.observeRequest = self.pushRequest;
            return self;
          })(this.requestObserver || {});

          Requests.onRequest.addListener(this.requestObserver.observeRequest);
          this.listening = true;
        """, sandbox=self._sandbox, new_sandbox=False)

    def stop_listening(self):
        """Stop observing requests."""

        if not self.listening:
            return

        return self.marionette.execute_script("""
          const {Requests} = """ + GET_BACKGROUND_PAGE + """;
          Requests.onRequest.removeListener(this.requestObserver.observeRequest);
          this.listening = false;
        """, sandbox=self._sandbox, new_sandbox=False)

    @contextmanager
    def listen(self):
        self.start_listening()
        try:
            yield
        finally:
            self.stop_listening()

    def cleanup_sandbox(self):
        """Clean up the sandbox."""

        if self.listening:
            self.stop_listening()

        # Mainly send `new_sandbox=True`.
        self.marionette.execute_script("", sandbox=self._sandbox,
                                       new_sandbox=True)

    def clear(self):
        """Clear info about requests but continue to listen."""

        if not self.listening:
            return

        self.marionette.execute_script("""
          this.requestObserver.requests = [];
        """, sandbox=self._sandbox, new_sandbox=False)
