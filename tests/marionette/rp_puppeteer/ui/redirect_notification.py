# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from marionette_driver.errors import NoSuchElementException
from marionette_driver.wait import Wait
import time


class RedirectNotification(BaseLib):
    # TODO: use notification bar class when bug 1139544 lands

    #################################
    # Public Properties and Methods #
    #################################

    def is_shown(self):
        """Check if the redirection notification bar is present."""

        # Wait some time to make sure the check happens not too early.
        # In that case `is_shown()` would return `False`, but it should
        # return `True`.
        # FIXME: Find a better solution than `sleep()`.
        time.sleep(0.1)

        try:
            self._panel
            return True
        except NoSuchElementException:
            return False

    def close(self):
        """Close the notification bar."""

        self._close_button.click()
        Wait(self.marionette).until(lambda _: not self.is_shown())

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

    @property
    def _close_button(self):
        return (
            self._panel
            .find_element("anon attribute",
                          {"class": "messageCloseButton close-icon tabbable"})
        )
