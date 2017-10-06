# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.rules import Rule
from marionette import SkipTest
from rp_ui_harness.test_data.rules import ExemplaryRules


class RulesTableTestCase(RequestPolicyTestCase):

    def setUp(self):
        super(RulesTableTestCase, self).setUp()

        self.marionette.set_context("content")
        self.settings.your_policy.open()

        self.table = self.settings.your_policy.rules_table

        self.data = ExemplaryRules(lambda: self.marionette)

    def tearDown(self):
        try:
            self.rules.remove_all()
            self.marionette.set_context("chrome")
        finally:
            super(RulesTableTestCase, self).tearDown()


class SingleRule_RulesTableTestCase(RulesTableTestCase):
    rule = None

    def setUp(self):
        super(SingleRule_RulesTableTestCase, self).setUp()
        self.rule.add()

    def tearDown(self):
        try:
            self.rule.remove()
        finally:
            super(SingleRule_RulesTableTestCase, self).tearDown()


# ==============================================================================


class TestRulesTable(RulesTableTestCase):

    def test_get_all_rule_rows(self):
        raise SkipTest("The 'Rules' API doesn't support subscription rules "
                       "yet.")

    def test_count_rules(self):
        # Alias for `count_rules()`
        count = self.table.count_rules

        self.assertEqual(self.rules.count_rules(), 0,
                         "There are no user rules yet.")

        # Remember the number of rule rows. The counter includes
        # subscription rules.
        num_rules_initial = count()

        rule = self.data.some_rules[0]

        # Add a rule
        rule.add()
        self.assertEqual(count(), num_rules_initial + 1)

        # Remove the rule
        rule.remove()
        self.assertEqual(count(), num_rules_initial)


# ==============================================================================


class TestYourPolicyRulesTable(RulesTableTestCase):

    def test_get_user_rule_rows(self):
        self.assertEqual(len(self.table.user_rule_rows), 0,
                         "There are no user rules yet.")

        # Add some rules
        some_rules = self.data.some_rules
        for rule in some_rules:
            rule.add()

        # Get the user rule rows.
        user_rule_rows = self.table.user_rule_rows
        # Compare the amount of rules.
        self.assertEqual(len(user_rule_rows), len(some_rules),
                         "The correct amount of rules have been added.")

        # Convert rule-rows to `Rule` instances.
        returned_rules = [row.create_rule() for row in user_rule_rows]

        # Compare the two `Rule` lists.
        self.assertEqual(returned_rules.sort(), some_rules.sort(),
                         "All rules have been added and returned correctly.")

    def test_get_rule_rows_by_ruleset_string(self):
        permanent_rule = self.data.allow_rule
        temporary_rule = self.data.temp_deny_rule

        permanent_rule.add()
        temporary_rule.add()

        def get_rules(ruleset_string):
            rule_rows = (self.table
                         .get_rule_rows_by_ruleset_string(ruleset_string))
            return [row.create_rule() for row in rule_rows]

        returned_temporary_rules = get_rules("Temporary")
        returned_permanent_rules = get_rules("User")
        rules_with_empty_ruleset_string = get_rules("")

        self.assertEqual(returned_temporary_rules, [temporary_rule])
        self.assertEqual(returned_permanent_rules, [permanent_rule])
        self.assertEqual(rules_with_empty_ruleset_string, [])


# ==============================================================================


class TestRuleRow(RulesTableTestCase):
    def test_policy_property(self):
        def assert_policy(policy_string_id):
            # Get the localized policy string.
            expected_policy_string = self.l10n.get_rp_property(
                policy_string_id)

            rule_row = self.table.user_rule_rows[0]
            returned_policy_string = rule_row.policy

            self.assertEqual(returned_policy_string, expected_policy_string)

        def test_rule(rule, policy_string_id):
            rule.add()
            assert_policy(policy_string_id)
            rule.remove()

        # Test using a rule with "allow" policy.
        test_rule(self.data.allow_rule, "allow")

        # Test using a rule with "deny" policy.
        test_rule(self.data.deny_rule, "block")

    def test_origin_empty(self):
        self.data.rule_without_origin.add()
        origin_string = self.table.user_rule_rows[0].origin
        self.assertEqual(origin_string, "")

    def test_dest_empty(self):
        self.data.rule_without_dest.add()
        dest_string = self.table.user_rule_rows[0].dest
        self.assertEqual(dest_string, "")


# ------------------------------------------------------------------------------


class TestRuleRow_OriginOrDestProperty:
    class Test(RulesTableTestCase):
        endpoint = None
        spec_id = None

        def test_origin_and_dest_properties(self):
            spec = self.data.pre_path_specs[self.spec_id]

            def create_rule():
                """Create the rule from the spec info."""
                endpoint_short = "o" if self.endpoint == "origin" else "d"
                rule_data = {endpoint_short: spec["spec"]}
                return self.rules.create_rule(rule_data, allow=True)

            # Create and add the rule.
            rule = create_rule()
            rule.add()

            # Check if the cell text matches the expected string.
            rule_row = self.table.user_rule_rows[0]
            returned_string = getattr(rule_row, self.endpoint)
            self.assertEqual(returned_string, spec["expected_string"])

            # Remove the rule again.
            rule.remove()


class TestRuleRow_OriginProperty(TestRuleRow_OriginOrDestProperty.Test):
    endpoint = "origin"
    spec_id = "shp"


class TestRuleRow_DestProperty(TestRuleRow_OriginOrDestProperty.Test):
    endpoint = "dest"
    spec_id = "shp"


# ------------------------------------------------------------------------------


class TestRuleRow_RuleCreation:
    class Test(RulesTableTestCase):
        spec_id = None
        allow = True
        temp = True

        def test_create_rule(self):
            def create_rule():
                spec = self.data.pre_path_specs[self.spec_id]
                rule_data = {"o": spec["spec"], "d": spec["spec"]}
                return self.rules.create_rule(
                    rule_data, allow=self.allow, temp=self.temp)

            # Create and add the rule.
            rule = create_rule()
            rule.add()

            rule_row = self.table.user_rule_rows[0]
            returned_rule = rule_row.create_rule()
            self.assertIsInstance(returned_rule, Rule)
            # The returned rule should be identical to what has been added.
            self.assertEqual(returned_rule, rule)

            rule.remove()


# Test all possible pre-path specs.


class TestRuleRow_RuleCreation_Scheme(TestRuleRow_RuleCreation.Test):
    spec_id = "s"


class TestRuleRow_RuleCreation_Host(TestRuleRow_RuleCreation.Test):
    spec_id = "h"


class TestRuleRow_RuleCreation_Port(TestRuleRow_RuleCreation.Test):
    spec_id = "p"


class TestRuleRow_RuleCreation_SchemeHost(TestRuleRow_RuleCreation.Test):
    spec_id = "sh"


class TestRuleRow_RuleCreation_SchemePort(TestRuleRow_RuleCreation.Test):
    spec_id = "sp"


class TestRuleRow_RuleCreation_HostPort(TestRuleRow_RuleCreation.Test):
    spec_id = "hp"


class TestRuleRow_RuleCreation_SchemeHost(TestRuleRow_RuleCreation.Test):
    spec_id = "shp"


# Test rules with all origin/dest fields specified.


class TestRuleRow_RuleCreation_SchemeHostPort_AllowPermanent(
    TestRuleRow_RuleCreation.Test
):
    spec_id = "shp"
    allow = True
    temp = False


class TestRuleRow_RuleCreation_SchemeHostPort_BlockTemporarily(
    TestRuleRow_RuleCreation.Test
):
    spec_id = "shp"
    allow = False
    temp = True


# ==============================================================================


class TestYourPolicyRuleRow_RuleSetProperty:
    class Test(SingleRule_RulesTableTestCase):
        expected_ruleset_string = None

        def test_rule_set_property(self):
            self.assertEqual(self.table.user_rule_rows[0].rule_set,
                             self.expected_ruleset_string)


class TestYourPolicyRuleRow_RuleSetProperty_AllowPermanent(
        TestYourPolicyRuleRow_RuleSetProperty.Test):
    rule = property(lambda self: self.data.allow_rule)
    expected_ruleset_string = "User"


class TestYourPolicyRuleRow_RuleSetProperty_AllowTemp(
        TestYourPolicyRuleRow_RuleSetProperty.Test):
    rule = property(lambda self: self.data.temp_allow_rule)
    expected_ruleset_string = "Temporary"


# ------------------------------------------------------------------------------


class TestYourPolicyRuleRow_RemoveRule(RulesTableTestCase):

    def test_remove_rule(self):
        for rule in self.data.some_rules:
            rule.add()
            self.assertTrue(rule.exists())
            self.table.user_rule_rows[0].remove()
            self.assertFalse(rule.exists())


# ------------------------------------------------------------------------------


class TestYourPolicyRuleRow_IsUserRule:
    class Test(SingleRule_RulesTableTestCase):
        is_user_rule = None

        def test_is_user_rule(self):
            self.assertEqual(self.table.user_rule_rows[0].is_user_rule(),
                             self.is_user_rule)


# Test some user rules, that is, both temporary and permanent rules.


class TestYourPolicyRuleRow_IsUserRule_UserAllowRule(
        TestYourPolicyRuleRow_IsUserRule.Test):
    rule = property(lambda self: self.data.allow_rule)
    is_user_rule = True


class TestYourPolicyRuleRow_IsUserRule_TempUserAllowRule(
        TestYourPolicyRuleRow_IsUserRule.Test):
    rule = property(lambda self: self.data.temp_allow_rule)
    is_user_rule = True


# TODO: Test some non-user rules (subscription rules).
#       In those cases `is_user_rule()` should return `False`.


# ------------------------------------------------------------------------------


class TestYourPolicyRuleRow_IsTemp:
    class Test(SingleRule_RulesTableTestCase):
        is_temp = None

        def test_is_temporary(self):
            self.assertEqual(self.table.user_rule_rows[0].is_temporary(),
                             self.is_temp)


# Test both temporary and permanent rules.


class TestYourPolicyRuleRow_IsTemp_PermanentRule(
        TestYourPolicyRuleRow_IsTemp.Test):
    rule = property(lambda self: self.data.allow_rule)
    is_temp = False


class TestYourPolicyRuleRow_IsTemp_PermanentRule(
        TestYourPolicyRuleRow_IsTemp.Test):
    rule = property(lambda self: self.data.temp_allow_rule)
    is_temp = True
