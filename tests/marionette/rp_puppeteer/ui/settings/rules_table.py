# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib, ElementBaseLib
from rp_puppeteer.api.rules import Rule
from rp_puppeteer.api.l10n import L10n
import re


class RuleRow(ElementBaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    # Properties to get the strings of the corresponding table cells.
    policy = property(lambda self: self._get_cell_text_content(0))
    origin = property(lambda self: self._get_cell_text_content(1))
    dest = property(lambda self: self._get_cell_text_content(2))

    def create_rule(self):
        """Create a `Rule` instance for this rule row."""

        allow_string = L10n(lambda: self.marionette).get_rp_property("allow")
        allow = self.policy == allow_string
        temp = (self.is_temporary()
                if hasattr(self, "is_temporary")
                else False)
        rule_data = RuleRow._get_rule_data_from_strings(self.origin, self.dest)

        return Rule(lambda: self.marionette, rule_data, allow, temp)

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _cells(self):
        return self.element.find_elements("tag name", "td")

    def _get_cell_text_content(self, column_index):
        return self._cells[column_index].text

    @staticmethod
    def _get_rule_data_from_strings(origin_string, dest_string):
        origin = RuleRow._get_endpoint_spec_from_string(origin_string)
        dest = RuleRow._get_endpoint_spec_from_string(dest_string)
        rule_data = {}
        assert origin or dest
        if origin:
            rule_data["o"] = origin
        if dest:
            rule_data["d"] = dest
        return rule_data

    @staticmethod
    def _get_endpoint_spec_from_string(string):
        # Case: Endpoint not specified.
        if string == "":
            return None

        # Case: No host, empty host or host optional
        match = re.match(r"""^
                             ([^:]+):     # scheme
                             (//)?<path>
                             \s
                             \(([^)]+)\)
                             $""", string, flags=re.X)
        if match:
            scheme = match.group(1)
            info = match.group(3)
            spec = {}
            if scheme != "*":
                spec["s"] = scheme
            if info == "no host":
                spec["h"] = None
            elif info == "empty host":
                spec["h"] = ""
            elif info != "host optional":
                raise SyntaxError
            return spec

        # Case: URI without host, but with path
        match = re.match(r"""^
                             ([^:]+):  # scheme
                             ([^/]+)   # path
                             $""", string, flags=re.X)
        if match:
            scheme = match.group(1)
            path = match.group(2)
            spec = {}
            if scheme != "*":
                spec["s"] = scheme
            if path != "*":
                # Path support is not implemented yet.
                raise NotImplementedError
            if spec == {}:
                raise SyntaxError
            return spec

        # Case: An URI with host, optionally with scheme and port.
        match = re.match(r"""^
                             (?:   ([^:]+)  :// )?  # scheme (optional)
                                   ([^:/]+)         # host
                             (?: : ([^/]+)      )?  # port (optional)
                             $""", string, flags=re.X)
        if match:
            spec = {}
            scheme = match.group(1)
            host = match.group(2)
            port = match.group(3)
            if scheme and scheme != "*":
                spec["s"] = scheme
            if host != "*":
                spec["h"] = host
            if port and port != "*":
                spec["port"] = port
            if spec == {}:
                raise SyntaxError
            return spec

        # Nothing matched.
        raise SyntaxError


class YourPolicyRuleRow(RuleRow):

    #################################
    # Public Properties and Methods #
    #################################

    # Properties to get the strings of the corresponding table cells.
    rule_set = property(lambda self: self._get_cell_text_content(3))

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
