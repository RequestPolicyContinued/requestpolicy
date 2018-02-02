# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib
from .rules_table import RulesTable


class OldRulesPage(BaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def rules_table(self):
        return RulesTable(lambda: self.marionette)

    def open(self):
        self.marionette.navigate("about:requestpolicy?oldrules")

    def show_rules(self):
        self._show_rules_button.click()

    def import_rules(self):
        self._import_button.click()

    def delete_old_rules(self):
        self._delete_button.click()

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _show_rules_button(self):
        return self.marionette.find_element(
            "id", "showOldRuleReimportOptionsButton")

    @property
    def _import_button(self):
        return self.marionette.find_element("id", "importOldRulesButton")

    @property
    def _delete_button(self):
        return self.marionette.find_element("id", "deleteOldRulesButton")
