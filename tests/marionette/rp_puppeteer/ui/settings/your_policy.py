# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib, HTMLFormBaseLib
from rp_puppeteer.errors import RadioButtonException
from .rules_table import YourPolicyRulesTable


class YourPolicy(BaseLib):

    @property
    def add_rule_form(self):
        form = self.marionette.find_element("id", "addruleform")
        return AddRuleForm(lambda: self.marionette, form)

    @property
    def rules_table(self):
        return YourPolicyRulesTable(lambda: self.marionette)

    def open(self):
        self.marionette.navigate("about:requestpolicy?yourpolicy")


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
