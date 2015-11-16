# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib, ElementBaseLib
from rp_puppeteer.api.rules import Rule


class RuleRow(ElementBaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    # Properties to get the strings of the corresponding table cells.
    policy = property(lambda self: self._get_cell_text_content(0))
    origin = property(lambda self: self._get_cell_text_content(1))
    dest = property(lambda self: self._get_cell_text_content(2))

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _cells(self):
        return self.element.find_elements("tag name", "td")

    def _get_cell_text_content(self, column_index):
        return self._cells[column_index].get_attribute("textContent")


class YourPolicyRuleRow(RuleRow):

    #################################
    # Public Properties and Methods #
    #################################

    # Properties to get the strings of the corresponding table cells.
    rule_set = property(lambda self: self._get_cell_text_content(3))

    def create_rule(self):
        """Create a `Rule` instance for this rule row."""

        if not self.is_user_rule():
            # Getting non-user (e.g. subscription) rules is not implemented yet.
            raise NotImplementedError

        # The rule details are retained by RequestPolicy via `jQuery.data()`
        # on the "<a>x</a>" HTML anchor element, the element being clicked to
        # remove the rule.
        [rule_action, rule_data] = self.marionette.execute_script("""
          var anchor = $(arguments[0]);
          return [
            anchor.data('requestpolicyRuleAction'),
            anchor.data('requestpolicyRuleData')
          ];
        """, script_args=[self._remove_anchor])

        allow = True if rule_action == "allow" else False
        temp = self.is_temporary()

        return Rule(lambda: self.marionette, rule_data, allow, temp)

    def remove(self):
        self._remove_anchor.click()

    def is_user_rule(self):
        return self.rule_set in ["User", "Temporary"]

    def is_temporary(self):
        return self.rule_set == "Temporary"

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _remove_anchor(self):
        return self._cells[4].find_element("tag name", "a")


class RulesTable(BaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def all_rule_rows(self):
        """Get a list of all rules."""

        tr_elements = self._tbody.find_elements("tag name", "tr")
        return self._create_rule_rows(tr_elements)

    def count_rules(self):
        return self.marionette.execute_script("""
          return arguments[0].children.length
        """, script_args=[self._tbody])

    ##################################
    # Private Properties and Methods #
    ##################################

    _rule_row_class = RuleRow

    @property
    def _tbody(self):
        return self.marionette.find_element("id", "rules")

    def _create_rule_rows(self, tr_elements):
        return [self._create_rule_row(tr) for tr in tr_elements]

    def _create_rule_row(self, tr_element):
        return self._rule_row_class(lambda: self.marionette, tr_element)


class YourPolicyRulesTable(RulesTable):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def user_rule_rows(self):
        """Get a list of all user rules."""

        rows = []
        for ruleset_string in ["Temporary", "User"]:
            rows += self.get_rule_rows_by_ruleset_string(ruleset_string)
        return rows

    def get_rule_rows_by_ruleset_string(self, ruleset_string):
        # XPath to get all <tr> elements where the fourth <td> child (the
        # rule-set column) contains the exact string `ruleset_string`.
        xpath = "tr[./td[4]='{}']".format(ruleset_string)
        tr_elements = self._tbody.find_elements("xpath", xpath)
        return self._create_rule_rows(tr_elements)

    ##################################
    # Private Properties and Methods #
    ##################################

    _rule_row_class = YourPolicyRuleRow

    @property
    def _filter_field(self):
        return self.marionette.find_element("id", "rulesearch")
