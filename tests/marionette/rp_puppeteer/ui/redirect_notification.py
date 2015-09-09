# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from marionette_driver.errors import NoSuchElementException


REDIRECT_NOTIFICATION_VALUE = "request-policy-meta-redirect"


class RedirectNotification(BaseLib):
    def get_panel(self):
        """Find the redirection notification bar in the tab currently focused.

        Raises:
            NoSuchElementException
        """

        with self.marionette.using_context("chrome"):
            # TODO: use notification bar class when bug 1139544 lands
            return (self.marionette.find_element("id", "content")
                    .find_element("anon attribute",
                                  {"value": REDIRECT_NOTIFICATION_VALUE}))

    def panel_exists(self):
        """Check if the redirection notification bar is present.
        """

        try:
            self.get_panel()
            return True
        except NoSuchElementException:
            return False
