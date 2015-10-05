# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib


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

    def remove_all(self):
        for rule in self.all:
            rule.remove()

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
          var mod = {};
          Components.utils.import("chrome://rpcontinued/content/lib/" +
                                  "policy-manager.jsm", mod);
          var rawRuleset = mod.PolicyManager.getUserRulesets()[rulesetName]
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
          var mod = {};
          Components.utils.import("chrome://rpcontinued/content/lib/" +
                                  "policy-manager.jsm", mod);
          var rawRuleset = mod.PolicyManager.getUserRulesets()[rulesetName]
                                            .rawRuleset;
          return rawRuleset._entries[ruleActionString];
        """, script_args=[ruleset_name, rule_action_string])

        return [self.create_rule(rule_data, allow, temp)
                for rule_data in rule_data_list]


class Rule(BaseLib):
    """Class to represent a specific rule."""

    def __init__(self, marionette_getter, rule_data, allow, temp):
        super(Rule, self).__init__(marionette_getter)
        self.rule_data = rule_data
        self.allow = allow
        self.temp = temp

    def __eq__(self, other):
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
          var mod = {};
          Components.utils.import("chrome://rpcontinued/content/lib/" +
                                  "policy-manager.jsm", mod);
          if (temp === true) {
            mod.PolicyManager.addTemporaryRule(ruleAction, ruleData);
          } else {
            mod.PolicyManager.addRule(ruleAction, ruleData, noStore);
          }
        """, script_args=[self._rule_action, self.rule_data, self.temp,
                          not store])

    def remove(self, store=False):
        """Remove the rule from the user policy."""

        self.marionette.execute_script("""
          var ruleAction = arguments[0];
          var ruleData = arguments[1];
          var noStore = arguments[2];
          var mod = {};
          Components.utils.import("chrome://rpcontinued/content/lib/" +
                                  "policy-manager.jsm", mod);
          mod.PolicyManager.removeRule(ruleAction, ruleData, noStore);
        """, script_args=[self._rule_action, self.rule_data, not store])

    def exists(self):
        """Check if the rule exists."""

        return self.marionette.execute_script("""
          var rulesetName = arguments[0];
          var ruleAction = arguments[1];
          var ruleData = arguments[2];
          var mod = {};
          Components.utils.import("chrome://rpcontinued/content/lib/" +
                                  "policy-manager.jsm", mod);
          return mod.PolicyManager.getUserRulesets()[rulesetName]
                                  .rawRuleset
                                  .ruleExists(ruleAction, ruleData);
        """, script_args=[self._ruleset_name, self._rule_action,
                          self.rule_data])

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _ruleset_name(self):
        return "temp" if self.temp else "user"

    @property
    def _rule_action(self):
        return 1 if self.allow else 2
