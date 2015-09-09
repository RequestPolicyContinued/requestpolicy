# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from marionette_driver.wait import Wait


class Tabs(BaseLib):
    def is_loaded(self, tab):
        return tab.tab_element.get_attribute("busy") == None

    def wait_until_loaded(self, tab):
        Wait(self.marionette).until(lambda _: self.is_loaded(tab))
