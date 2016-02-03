# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from contextlib import contextmanager
from firefox_puppeteer.api.prefs import Preferences as FxPreferences
from firefox_puppeteer.base import BaseLib


PREF_PREFIX = "extensions.requestpolicy."


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

    @property
    def old_rules(self):
        return OldRulesPrefs(lambda: self.marionette)


def _pref_proprety(pref_name):
    full_pref_name = PREF_PREFIX + pref_name
    getter = lambda self: self.prefs.get_pref(full_pref_name)
    setter = lambda self, value: self.prefs.set_pref(full_pref_name, value)
    return property(getter, setter)


class OldRulesPrefs(BaseLib):

    PREFS = ("allowedOrigins", "allowedDestinations",
             "allowedOriginsToDestinations")

    def __init__(self, marionette_getter):
        super(OldRulesPrefs, self).__init__(marionette_getter)

        self.prefs = Preferences(lambda: self.marionette)

    def remove_all_prefs(self):
        for pref in self.PREFS:
            self.prefs.reset_pref(PREF_PREFIX + pref)

    def empty_all_prefs(self):
        for pref in self.PREFS:
            self.prefs.set_pref(PREF_PREFIX + pref, "")

    def set_rules(self, rules):
        for pref_name in self.PREFS:
            value = rules[pref_name] if pref_name in rules else ""
            self.prefs.set_pref(PREF_PREFIX + pref_name, value)

    def get_rules(self):
        rules = {}
        for pref_name in self.PREFS:
            rules[pref_name] = self.prefs.get_pref(PREF_PREFIX + pref_name)
        return rules

    origin_rules = _pref_proprety("allowedOrigins")
    dest_rules = _pref_proprety("allowedDestinations")
    origin_to_dest_rules = _pref_proprety("allowedOriginsToDestinations")
