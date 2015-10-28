# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib


class BrowserInfo(BaseLib):

    @property
    def e10s_enabled(self):
        return self.marionette.execute_script("""
          try {
            return Services.appinfo.browserTabsRemoteAutostart;
          } catch (e) {
            return false;
          }
        """)
