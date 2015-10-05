# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.rules import Rule
from marionette import SkipTest


class RulesTestCase(RequestPolicyTestCase):
    """Common test class."""

    def setUp(self):
        super(RulesTestCase, self).setUp()

        cr = self.rules.create_rule

        self.rules_1248 = [
            cr({"o": {"h": "a"}}, allow=False, temp=False),

            cr({"o": {"h": "b"}}, allow=False, temp=True),
            cr({"o": {"h": "c"}}, allow=False, temp=True),

            cr({"o": {"h": "d"}}, allow=True, temp=False),
            cr({"o": {"h": "e"}}, allow=True, temp=False),
            cr({"o": {"h": "f"}}, allow=True, temp=False),
            cr({"o": {"h": "g"}}, allow=True, temp=False),

            cr({"o": {"h": "h"}}, allow=True, temp=True),
            cr({"o": {"h": "i"}}, allow=True, temp=True),
            cr({"o": {"h": "j"}}, allow=True, temp=True),
            cr({"o": {"h": "k"}}, allow=True, temp=True),
            cr({"o": {"h": "l"}}, allow=True, temp=True),
            cr({"o": {"h": "m"}}, allow=True, temp=True),
            cr({"o": {"h": "n"}}, allow=True, temp=True),
            cr({"o": {"h": "o"}}, allow=True, temp=True)
        ]

        self.rules_4combinations_different_rule_data = [
            cr({"o": {"h": "a"}}, allow=False, temp=False),
            cr({"o": {"h": "b"}}, allow=False, temp=True),
            cr({"o": {"h": "c"}}, allow=True, temp=False),
            cr({"o": {"h": "d"}}, allow=True, temp=True)
        ]

        self.rules_4combinations_same_rule_data = [
            cr({"o": {"h": "a"}}, allow=False, temp=False),
            cr({"o": {"h": "a"}}, allow=False, temp=True),
            cr({"o": {"h": "a"}}, allow=True, temp=False),
            cr({"o": {"h": "a"}}, allow=True, temp=True)
        ]

        self.baserule = cr({"o": {"h": "a"}}, allow=False, temp=False)
        self.temp_baserule = cr({"o": {"h": "a"}}, allow=False, temp=True)
        self.baserule_variants = dict(
            different_rule_data=cr({"o": {"h": "b"}}, allow=False, temp=False),
            different_allow=cr({"o": {"h": "a"}}, allow=True, temp=False),
            different_temp=cr({"o": {"h": "a"}}, allow=False, temp=True)
        )

    def tearDown(self):
        try:
            self.rules.remove_all()
        finally:
            super(RulesTestCase, self).tearDown()

    @property
    def possible_allow_temp_param_combinations(self):
        """Get all possible combinations of `allow`/`temp` values."""

        # Both `allow` and `temp` parameters take a list of boolean values.
        possible_boolean_combinations = [[True], [False], [True, False]]

        return [(allow, temp)
                for allow in possible_boolean_combinations
                for temp in possible_boolean_combinations]


class TestRules(RulesTestCase):

    def test_get_and_count(self):
        all_rules = self.rules_1248

        # Add all rules.
        for rule in all_rules:
            rule.add()

        # Test `get_rules()` and `count_rules()` for all possible
        # combinations of `allow` and `temp` values.
        for allow, temp in self.possible_allow_temp_param_combinations:
            # Determine the rules which should be expected. To do so,
            # take `all_rules` and filter out rules with non-matching
            # `allow` and `temp` values.
            def _filter(rule):
                return rule.allow in allow and rule.temp in temp
            expected_rules = filter(_filter, all_rules)
            expected_rules.sort()

            # Get the rules via `get_rules()`.
            returned_rules = self.rules.get_rules(allow=allow, temp=temp)
            returned_rules.sort()

            # Some debug info about this sub-testcase.
            debug_info = (
                "allow: {}, temp: {}, returned rules: {}, "
                "expected rules: {}"
            ).format(
                allow, temp,
                [r.rule_data["o"]["h"] for r in returned_rules],
                [r.rule_data["o"]["h"] for r in expected_rules]
            )

            # Check `get_rules()` output.
            self.assertEqual(expected_rules, returned_rules, msg=debug_info)

            expected_count = len(expected_rules)
            returned_count = self.rules.count_rules(allow=allow, temp=temp)

            # Check `count_rules()` output.
            self.assertEqual(expected_count, returned_count, msg=debug_info)

    def test_rule_exists_takes_list_or_boolean(self):
        # Check that both lists and boolean values can be passed to
        # `rule_exists()`.

        rule = self.baserule
        rule.add()
        self.assertTrue(self.rules.rule_exists(rule.rule_data, rule.allow,
                                               rule.temp))
        self.assertTrue(self.rules.rule_exists(rule.rule_data, [rule.allow],
                                               [rule.temp]))

    def test_rule_exists_filtering(self):
        # Test `rule_exists()` filtering by allow/deny values.

        for rule in self.rules_4combinations_same_rule_data:
            # add rule
            rule.add()

            # Check `rule_exists()` for all possible allow/temp combinations.
            for allow, temp in self.possible_allow_temp_param_combinations:
                expected_result = (rule.allow in allow and
                                   rule.temp in temp)
                returned_result = self.rules.rule_exists(rule.rule_data,
                                                         allow=allow, temp=temp)
                self.assertEqual(expected_result, returned_result)

            # remove rule
            rule.remove()

    def test_remove_all(self):
        for rule in self.rules_4combinations_different_rule_data:
            rule.add()
        self.rules.remove_all()
        self.assertEqual(self.rules.count_rules(), 0)


class TestRule(RulesTestCase):

    def test_eq_and_ne_rich_comparisons(self):
        # Test that `Rule` has both the __eq__ and the __ne__ method
        self.assertIn("__eq__", dir(Rule))
        self.assertIn("__ne__", dir(Rule))

        # Create a copy of the "baserule".
        baserule_copy = self.rules.create_rule(
            rule_data=self.baserule.rule_data,
            allow=self.baserule.allow,
            temp=self.baserule.temp
        )
        self.assertEqual(self.baserule, baserule_copy,
                         msg="Two copies of the same rule are equal.")

        # All variants should be unequal to the base rule.
        for variant_name, rule in self.baserule_variants.items():
            self.assertNotEqual(self.baserule, rule,
                                msg=("Variant '{}' and the Baserule are "
                                     "unequal.".format(variant_name)))

        # Compare with non-`Rule` instances.
        self.assertNotEqual(self.baserule, None)
        self.assertNotEqual(self.baserule, {})
        self.assertNotEqual(self.baserule, [])
        self.assertNotEqual(self.baserule, 10)

    def test_adding_and_removing_rule(self):
        rule = self.baserule
        self.assertEqual(self.rules.count_rules(), 0)
        rule.add()
        self.assertEqual(self.rules.count_rules(), 1,
                         msg="Exactly one rule has been added.")
        self.assertEqual(self.rules.all[0], self.baserule,
                         msg="The rule has been added correctly.")
        rule.remove()
        self.assertEqual(self.rules.count_rules(), 0)

    def test_removing_one_of_coexistent_temporary_and_permanent_rules(self):
        raise SkipTest("Skipping due to issue #712.")

        # (1) add a rule twice, once temp, once permanet.
        # (2) remove one of them

        perm_rule = self.baserule
        temp_rule = self.temp_baserule

        def add_both_rules():
            perm_rule.add()
            temp_rule.add()
            self.assertTrue(perm_rule.exists())
            self.assertTrue(temp_rule.exists())

        # (1) add the rules
        add_both_rules()

        # (2) remove one rule
        temp_rule.remove()
        self.assertTrue(perm_rule.exists())
        self.assertFalse(temp_rule.exists())

        # back to (1)
        add_both_rules()

        # again (2)
        perm_rule.remove()
        self.assertFalse(perm_rule.exists())
        self.assertTrue(temp_rule.exists())

    def test_exists(self):
        rules = self.rules_4combinations_different_rule_data

        for rule in rules:
            self.assertFalse(rule.exists())
            rule.add()
            self.assertTrue(rule.exists())
