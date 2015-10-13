# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from marionette_driver.errors import NoSuchElementException


class RedirectNotification(BaseLib):
    # TODO: use notification bar class when bug 1139544 lands

    #################################
    # Public Properties and Methods #
    #################################

    def is_shown(self):
        """Check if the redirection notification bar is present."""

        try:
            self._panel
            return True
        except NoSuchElementException:
            return False

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _panel(self):
        """The redirection notification bar in the tab currently focused."""

        return (
            self.marionette
            .find_element("id", "content")
            .find_element("anon attribute",
                          {"value": "request-policy-meta-redirect"})
        )
