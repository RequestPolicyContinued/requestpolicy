# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
import copy
import os.path
import json


GET_BACKGROUND_PAGE = """
    Components.utils.
        import("chrome://rpcontinued/content/bootstrap/bootstrap.jsm", {}).
        FakeWebExt.Api.browser.extension.getBackgroundPage()
"""


class Rules(BaseLib):
    """Class for managing user rules."""

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def all(self):
        return self.get_rules()

    def create_rule(self, rule_data, allow, temp=False):
        """Create a `Rule` instance."""

        return Rule(lambda: self.marionette, rule_data, allow, temp)

    def get_rules(self, allow=[True, False], temp=[True, False]):
        if not isinstance(allow, list):
            allow = [allow]
        if not isinstance(temp, list):
            temp = [temp]

        rules = []

        for allow_value in allow:
            for temp_value in temp:
                rules += self._get_rules(allow_value, temp_value)

        return rules

    def rule_exists(self, rule_data, allow=[True, False], temp=[True, False]):
        if not isinstance(allow, list):
            allow = [allow]
        if not isinstance(temp, list):
            temp = [temp]

        for allow_value in allow:
            for temp_value in temp:
                rule = self.create_rule(rule_data, allow_value, temp_value)
                if rule.exists():
                    return True

        return False

    def count_rules(self, allow=[True, False], temp=[True, False]):
        """Count the number of rules."""

        if not isinstance(allow, list):
            allow = [allow]
        if not isinstance(temp, list):
            temp = [temp]

        counter = 0
        for allow_value in allow:
            for temp_value in temp:
                counter += self._count_rules(allow_value, temp_value)
        return counter

    def remove_all(self, store=False):
        for rule in self.all:
            rule.remove(store=False)
        if store:
            self.save()

    def save(self):
        """Save the rules to the json file."""

        return self.marionette.execute_script("""
          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          PolicyManager.storeRules();
        """)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _count_rules(self, allow, temp):
        """Count the number of rules for one specific allow/temp combination.
        """

        ruleset_name = "temp" if temp else "user"

        return self.marionette.execute_script("""
          var rulesetName = arguments[0];
          var allow = arguments[1];

          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          var rawRuleset = PolicyManager.getUserRulesets()[rulesetName]
                                        .rawRuleset;
          if (allow === true) {
            return rawRuleset.getAllowRuleCount();
          } else {
            return rawRuleset.getDenyRuleCount();
          }
        """, script_args=[ruleset_name, allow])

    def _get_rules(self, allow, temp):
        """Get the rules for one specific allow/temp combination."""

        ruleset_name = "temp" if temp else "user"
        rule_action_string = "allow" if allow else "deny"

        rule_data_list = self.marionette.execute_script("""
          var rulesetName = arguments[0];
          var ruleActionString = arguments[1];

          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          var rawRuleset = PolicyManager.getUserRulesets()[rulesetName]
                                        .rawRuleset;
          return rawRuleset._entries[ruleActionString];
        """, script_args=[ruleset_name, rule_action_string])

        return [self.create_rule(rule_data, allow, temp)
                for rule_data in rule_data_list]


class RulesFile(BaseLib):

    def __init__(self, marionette_getter, file_path="user.json"):
        super(RulesFile, self).__init__(marionette_getter)

        if os.path.isabs(file_path):
            self.file_path = file_path
        else:
            profile_path = self.marionette.instance.profile.profile
            self.file_path = ("{}/requestpolicy/policies/{}"
                              .format(profile_path, file_path))

    #################################
    # Public Properties and Methods #
    #################################

    def get_rules(self):
        if not os.path.isfile(self.file_path):
            return None

        with open(self.file_path, 'r') as f:
            json_data = json.loads(f.read())

        assert json_data["metadata"]["version"] is 1

        entries = json_data["entries"]
        rules = []

        for (keyword, is_allow) in [("allow", True), ("deny", False)]:
            if keyword not in entries:
                continue

            for rule_data in entries[keyword]:
                rules.append(Rule(lambda: self.marionette, rule_data,
                                  allow=is_allow, temp=False))

        return rules

    def remove(self):
        if os.path.isfile(self.file_path):
            os.remove(self.file_path)


class Rule(BaseLib):
    """Class to represent a specific rule."""

    def __init__(self, marionette_getter, rule_data, allow, temp):
        super(Rule, self).__init__(marionette_getter)
        self._set_rule_data(rule_data)
        self.allow = allow
        self.temp = temp

    def __eq__(self, other):
        if not isinstance(other, Rule):
            return False
        return (self.allow == other.allow and self.temp == other.temp and
                self.rule_data == other.rule_data)

    def __ne__(self, other):
        return not self.__eq__(other)

    def __cmp__(self, other):
        # Temporary rules first.
        if self.temp != other.temp:
            return -1 if self.temp else 1
        # "Deny" rules first.
        if self.allow != other.allow:
            return -1 if not self.allow else 1
        # Use the dictionary's (`dict`) comparison operators on `rule_data`.
        if self.rule_data < other.rule_data:
            return -1
        elif self.rule_data == other.rule_data:
            return 0
        else:
            return 1

    def __repr__(self):
        return ("Rule(rule_data={}, allow={}, temp={})"
                .format(self.rule_data, self.allow, self.temp))

    #################################
    # Public Properties and Methods #
    #################################

    def add(self, store=False):
        """Add the rule to the user policy."""

        self.marionette.execute_script("""
          var ruleAction = arguments[0];
          var ruleData = arguments[1];
          var temp = arguments[2];
          var noStore = arguments[3];

          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          if (temp === true) {
            PolicyManager.addTemporaryRule(ruleAction, ruleData);
          } else {
            PolicyManager.addRule(ruleAction, ruleData, noStore);
          }
        """, script_args=[self._rule_action, self.rule_data, self.temp,
                          not store])

    def remove(self, store=False):
        """Remove the rule from the user policy."""

        self.marionette.execute_script("""
          var ruleAction = arguments[0];
          var ruleData = arguments[1];
          var noStore = arguments[2];

          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          PolicyManager.removeRule(ruleAction, ruleData, noStore);
        """, script_args=[self._rule_action, self.rule_data, not store])

    def exists(self):
        """Check if the rule exists."""

        return self.marionette.execute_script("""
          var rulesetName = arguments[0];
          var ruleAction = arguments[1];
          var ruleData = arguments[2];

          var {PolicyManager} = """ + GET_BACKGROUND_PAGE + """;
          return PolicyManager.getUserRulesets()[rulesetName]
                              .rawRuleset
                              .ruleExists(ruleAction, ruleData);
        """, script_args=[self._ruleset_name, self._rule_action,
                          self.rule_data])

    origin_scheme = property(lambda self: self._get_rule_data_entry("o", "s"))
    origin_host = property(lambda self: self._get_rule_data_entry("o", "h"))
    origin_port = property(lambda self: self._get_rule_data_entry("o", "port"))
    dest_scheme = property(lambda self: self._get_rule_data_entry("d", "s"))
    dest_host = property(lambda self: self._get_rule_data_entry("d", "h"))
    dest_port = property(lambda self: self._get_rule_data_entry("d", "port"))

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _ruleset_name(self):
        return "temp" if self.temp else "user"

    @property
    def _rule_action(self):
        return 1 if self.allow else 2

    def _get_rule_data_entry(self, first, second):
        if first in self.rule_data and second in self.rule_data[first]:
            return self.rule_data[first][second]
        return None

    def _set_rule_data(self, new_rule_data):
        rule_data = copy.deepcopy(new_rule_data)
        # Convert port numbers to integer
        if "o" in rule_data and "port" in rule_data["o"]:
            rule_data["o"]["port"] = int(rule_data["o"]["port"])
        if "d" in rule_data and "port" in rule_data["d"]:
            rule_data["d"]["port"] = int(rule_data["d"]["port"])
        self.rule_data = rule_data
