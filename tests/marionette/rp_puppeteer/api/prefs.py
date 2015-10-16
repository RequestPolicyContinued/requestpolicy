# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from contextlib import contextmanager
from firefox_puppeteer.api.prefs import Preferences as FxPreferences


class Preferences(FxPreferences):

    @contextmanager
    def using_pref(self, pref_name, pref_value):
        """Context manager for setting a pref temporarily.

        :param pref_name: The preference to set.
        :param pref_value: The value to set the preference to.
        """

        self.set_pref(pref_name, pref_value)
        try:
            yield
        finally:
            self.reset_pref(pref_name)
