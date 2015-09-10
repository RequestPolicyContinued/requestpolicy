# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib


class WebUtils(BaseLib):
    """Utils for the Web API."""

    def select_element_text(self, element):
        """Select the text content of an HTML Element."""

        self.marionette.execute_script("""
          var element = arguments[0];
          var selection = element.ownerDocument.defaultView.getSelection();
          var range = element.ownerDocument.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
        """, script_args=[element])
