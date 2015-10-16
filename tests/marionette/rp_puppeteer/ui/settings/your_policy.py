# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib, ElementBaseLib, HTMLFormBaseLib
from rp_puppeteer.errors import RadioButtonException
from rp_puppeteer.api.rules import Rule


class YourPolicy(BaseLib):

    @property
    def add_rule_form(self):
        form = self.marionette.find_element("id", "addruleform")
        return AddRuleForm(lambda: self.marionette, form)

    @property
    def rules_table(self):
        return RulesTable(lambda: self.marionette)

    def open(self):
        self.marionette.navigate("about:requestpolicy?yourpolicy")


class RulesTable(BaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def all_rule_rows(self):
        """Get a list of all rules."""

        tr_elements = self._tbody.find_elements("tag name", "tr")
        return self._create_rule_rows(tr_elements)

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

    def count_rules(self):
        return self.marionette.execute_script("""
          return arguments[0].children.length
        """, script_args=[self._tbody])

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _tbody(self):
        return self.marionette.find_element("id", "rules")

    @property
    def _filter_field(self):
        return self.marionette.find_element("id", "rulesearch")

    def _create_rule_rows(self, tr_elements):
        return [RuleRow(lambda: self.marionette, tr) for tr in tr_elements]


class RuleRow(ElementBaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    # Properties to get the strings of the corresponding table cells.
    policy = property(lambda self: self._get_cell_text_content(0))
    origin = property(lambda self: self._get_cell_text_content(1))
    dest = property(lambda self: self._get_cell_text_content(2))
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
    def _cells(self):
        return self.element.find_elements("tag name", "td")

    def _get_cell_text_content(self, column_index):
        return self._cells[column_index].get_attribute("textContent")

    @property
    def _remove_anchor(self):
        return self._cells[4].find_element("tag name", "a")


class AddRuleForm(HTMLFormBaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def allow(self):
        allow_selected = self._allow_radio_button.is_selected()
        deny_selected = self._deny_radio_button.is_selected()
        if allow_selected == deny_selected:
            # Either both or none of the radio buttons is selected.
            raise RadioButtonException
        return allow_selected

    @allow.setter
    def allow(self, value):
        if value:
            self._allow_radio_button.click()
        else:
            self._deny_radio_button.click()

    @property
    def temp(self):
        return self._temp_check_box.is_selected()

    @temp.setter
    def temp(self, value):
        if self.temp != value:
            # Toggle the value.
            self._temp_check_box.click()

    # Property attributes to get the <input> HTML elements.
    origin_scheme = HTMLFormBaseLib.input_field("name", "originscheme")
    origin_host = HTMLFormBaseLib.input_field("name", "originhost")
    origin_port = HTMLFormBaseLib.input_field("name", "originport")
    dest_scheme = HTMLFormBaseLib.input_field("name", "destscheme")
    dest_host = HTMLFormBaseLib.input_field("name", "desthost")
    dest_port = HTMLFormBaseLib.input_field("name", "destport")

    def set_all_values(self, allow=True, origin_scheme="", origin_host="",
                       origin_port="", dest_scheme="", dest_host="",
                       dest_port="", temp=False):
        """Fill all form fields.

        All parameters are optional, but all fields will be set. All fields
        whose parameters arent's specified will be reset.
        """

        self.allow = allow
        self.temp = temp
        self.origin_scheme = origin_scheme
        self.origin_host = origin_host
        self.origin_port = origin_port
        self.dest_scheme = dest_scheme
        self.dest_host = dest_host
        self.dest_port = dest_port

    def set_all_values_by_rule(self, rule):
        """Fill the form using a `Rule` instance."""

        self.allow = rule.allow
        self.temp = rule.temp

        for field_name in ["origin_scheme", "origin_host", "origin_port",
                           "dest_scheme", "dest_host", "dest_port"]:
            # Get the field's value. If the value is not set it will be `None`,
            # so in that case `value` will be an empty string.
            value = getattr(rule, field_name) or ""
            setattr(self, field_name, value)

    def reset(self):
        """Reset all fields to its default value."""

        self.set_all_values()

    def submit(self):
        """Submit the form."""

        self._submit_button.click()

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _allow_radio_button(self):
        return self.element.find_element("id", "allowrule")

    @property
    def _deny_radio_button(self):
        return self.element.find_element("id", "denyrule")

    @property
    def _temp_check_box(self):
        return self.element.find_element("id", "temporary")

    @property
    def _submit_button(self):
        return self.element.find_element("css selector",
                                         "button[data-string=addRule]")
