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


class TestRuleRow(RulesTableTestCase):

    def test_policy_property(self):
        def assert_policy(policy_string_id):
            # Get the localized policy string.
            expected_policy_string = self.l10n.get_rp_property(policy_string_id)

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

    def test_origin_and_dest_properties(self):
        def test_pre_path_spec(endpoint, spec):
            def create_rule():
                """Create the rule from the spec info."""
                endpoint_short = "o" if endpoint == "origin" else "d"
                rule_data = {endpoint_short: spec["spec"]}
                return self.rules.create_rule(rule_data, allow=True)

            # Create and add the rule.
            rule = create_rule()
            rule.add()

            # Check if the cell text matches the expected string.
            rule_row = self.table.user_rule_rows[0]
            returned_string = getattr(rule_row, endpoint)
            self.assertEqual(returned_string, spec["expected_string"])

            # Remove the rule again.
            rule.remove()

        def test_endpoint(endpoint):
            assert endpoint in ["origin", "dest"]

            def test(spec_id):
                test_pre_path_spec(endpoint, self.data.pre_path_specs[spec_id])

            test("s")
            test("h")
            test("p")
            test("sh")
            test("sp")
            test("hp")
            test("shp")

        test_endpoint("origin")
        test_endpoint("dest")

    def test_origin_empty(self):
        self.data.rule_without_origin.add()
        origin_string = self.table.user_rule_rows[0].origin
        self.assertEqual(origin_string, "")

    def test_dest_empty(self):
        self.data.rule_without_dest.add()
        dest_string = self.table.user_rule_rows[0].dest
        self.assertEqual(dest_string, "")


class TestYourPolicyRuleRow(RulesTableTestCase):

    def test_rule_set_property(self):
        def test(rule, expected_ruleset_string):
            rule.add()
            self.assertEqual(self.table.user_rule_rows[0].rule_set,
                             expected_ruleset_string)
            rule.remove()

        test(self.data.allow_rule, "User")
        test(self.data.temp_allow_rule, "Temporary")

    def test_create_rule(self):
        def test(rule):
            rule.add()
            rule_row = self.table.user_rule_rows[0]
            returned_rule = rule_row.create_rule()
            self.assertIsInstance(returned_rule, Rule,
                                  "`create_rule()` has returned a `Rule` "
                                  "instance.")
            self.assertEqual(returned_rule, rule,
                             msg=("The returned rule is identical to what "
                                  "has been added."))
            rule.remove()

        # Test rules with all origin/dest fields specified.
        test(self.data.allow_rule_shp_shp)
        test(self.data.temp_deny_rule_shp_shp)

    def test_remove_rule(self):
        for rule in self.data.some_rules:
            rule.add()
            self.assertTrue(rule.exists())
            self.table.user_rule_rows[0].remove()
            self.assertFalse(rule.exists())

    def test_is_user_rule(self):
        def test_rule(rule, is_user_rule):
            rule.add()
            self.assertEqual(self.table.user_rule_rows[0].is_user_rule(),
                             is_user_rule)
            rule.remove()

        # Test some user rules, that is, both temporary and permanent rules.
        test_rule(self.data.allow_rule, True)
        test_rule(self.data.temp_allow_rule, True)

        # TODO: Test some non-user rules (subscription rules).
        #       In those cases `is_user_rule()` should return `False`.

    def test_is_temporary(self):
        def test_rule(rule, is_temp):
            rule.add()
            self.assertEqual(self.table.user_rule_rows[0].is_temporary(),
                             is_temp)
            rule.remove()

        # Test both temporary and permanent rules.
        test_rule(self.data.allow_rule, False)
        test_rule(self.data.temp_allow_rule, True)
