# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.api.rules import Rule
from marionette import SkipTest
from functools import partial


class YourPolicyTestCase(RequestPolicyTestCase):

    def setUp(self):
        super(YourPolicyTestCase, self).setUp()

        self.marionette.set_context("content")
        self.your_policy.open()

        self.rules_table = self.your_policy.rules_table
        self.add_rule_form = self.your_policy.add_rule_form

        #=======================================================================
        # Create some rules for the tests
        #=======================================================================

        # Alias for `create_rule()`
        cr = self.rules.create_rule

        # some rules that should not collide with each other
        self.allow_rule = cr({"o": {"h": "w"}}, allow=True, temp=False)
        self.temp_allow_rule = cr({"o": {"h": "x"}}, allow=True, temp=True)
        self.deny_rule = cr({"o": {"h": "y"}}, allow=False, temp=False)
        self.temp_deny_rule = cr({"o": {"h": "z"}}, allow=False, temp=True)
        self.some_rules = [self.allow_rule, self.temp_allow_rule,
                           self.deny_rule, self.temp_deny_rule]

        self.rule_without_origin = cr({"d": {"h": "foo"}}, allow=True)
        self.rule_without_dest = cr({"o": {"h": "bar"}}, allow=True)

        # A list of all possible pre-paths, including the expected string.
        self.pre_path_specs = {
            "s": {"spec": {"s": "s1"},
                  # The string "s1:*" could be confused with "*://s1:*"
                  "expected_string": 'scheme "s1"'},
            "h": {"spec": {"h": "h2"},
                  "expected_string": "h2"},
            "p": {"spec": {"port": 3},
                  "expected_string": "*://*:3"},
            "sh": {"spec": {"s": "s4", "h": "h4"},
                   "expected_string": "s4://h4"},
            "sp": {"spec": {"s": "s5", "port": 5},
                   "expected_string": "s5://*:5"},
            "hp": {"spec": {"h": "h6", "port": 6},
                   "expected_string": "*://h6:6"},
            "shp": {"spec": {"s": "s7", "h": "h7", "port": 7},
                    "expected_string": "s7://h7:7"}
        }

        self.allow_rule_shp_shp = cr({"o": {"s": "os", "h": "oh", "port": 1},
                                      "d": {"s": "ds", "h": "dh", "port": 2}},
                                     allow=True, temp=False)
        self.temp_deny_rule_shp_shp = cr(
                {"o": {"s": "os", "h": "oh", "port": 3},
                 "d": {"s": "ds", "h": "dh", "port": 4}},
                allow=False, temp=True)

        self.allow_rule_sh_p = cr({"o": {"s": "os", "h": "oh"}, "d": {"port": 5}},
                                  allow=True, temp=False)
        self.temp_deny_rule_s_hp = cr({"o": {"s": "os"},
                                       "d": {"h": "dh", "port": 4}},
                                      allow=False, temp=True)
        self.arbitrary_rule_shp_shp = cr(
            {"o": {"s": "fooscheme", "h": "barhost", "port": 18224},
             "d": {"s": "bazscheme", "h": "xyzhost", "port": 34755}},
            allow=False, temp=True)

    def tearDown(self):
        try:
            self.marionette.set_context("chrome")
        finally:
            super(YourPolicyTestCase, self).tearDown()

    @property
    def _user_rule_rows(self):
        return self.rules_table.user_rule_rows


class TestYourPolicy(YourPolicyTestCase):

    def test_open(self):
        self.marionette.navigate("about:blank")
        self.assertNotEqual(self.marionette.get_url(),
                            "about:requestpolicy?yourpolicy")
        self.your_policy.open()
        self.assertEqual(self.marionette.get_url(),
                         "about:requestpolicy?yourpolicy")


class TestRulesTable(YourPolicyTestCase):

    def test_get_all_rule_rows(self):
        raise SkipTest("The 'Rules' API doesn't support subscription rules "
                       "yet.")

    def test_get_user_rule_rows(self):
        self.assertEqual(len(self._user_rule_rows), 0,
                         "There are no user rules yet.")

        # Add some rules
        for rule in self.some_rules:
            rule.add()

        # Get the user rule rows.
        user_rule_rows = self._user_rule_rows
        # Compare the amount of rules.
        self.assertEqual(len(user_rule_rows), len(self.some_rules),
                         "The correct amount of rules have been added.")

        # Convert rule-rows to `Rule` instances.
        returned_rules = [row.create_rule() for row in user_rule_rows]

        # Compare the two `Rule` lists.
        self.assertEqual(returned_rules.sort(), self.some_rules.sort(),
                         "All rules have been added and returned correctly.")

    def test_get_rule_rows_by_ruleset_string(self):
        permanent_rule = self.allow_rule
        temporary_rule = self.temp_deny_rule

        permanent_rule.add()
        temporary_rule.add()

        def get_rules(ruleset_string):
            rule_rows = (
                self.rules_table
                .get_rule_rows_by_ruleset_string(ruleset_string)
            )
            return [row.create_rule() for row in rule_rows]

        returned_temporary_rules = get_rules("Temporary")
        returned_permanent_rules = get_rules("User")
        rules_with_empty_ruleset_string = get_rules("")

        self.assertEqual(returned_temporary_rules, [temporary_rule])
        self.assertEqual(returned_permanent_rules, [permanent_rule])
        self.assertEqual(rules_with_empty_ruleset_string, [])

    def test_count_rules(self):
        # Alias for `count_rules()`
        count = self.rules_table.count_rules

        self.assertEqual(self.rules.count_rules(), 0,
                         "There are no user rules yet.")

        # Remember the number of rule rows. The counter includes
        # subscription rules.
        num_rules_initial = count()

        # Add a rule
        self.some_rules[0].add()
        self.assertEqual(count(), num_rules_initial + 1)

        # Remove the rule
        self.some_rules[0].remove()
        self.assertEqual(count(), num_rules_initial)


class TestRuleRow(YourPolicyTestCase):

    def test_policy_property(self):
        def assert_policy(policy_string_id):
            # Get the localized policy string.
            expected_policy_string = self.l10n.get_rp_property(policy_string_id)

            rule_row = self._user_rule_rows[0]
            returned_policy_string = rule_row.policy

            self.assertEqual(returned_policy_string, expected_policy_string)

        def test_rule(rule, policy_string_id):
            rule.add()
            assert_policy(policy_string_id)
            rule.remove()

        # Test using a rule with "allow" policy.
        test_rule(self.allow_rule, "allow")

        # Test using a rule with "deny" policy.
        test_rule(self.deny_rule, "block")

    def _test_endpoint(self, endpoint):
        assert endpoint in ["origin", "dest"]

        def test(spec_id):
            self._test_pre_path_spec(endpoint, self.pre_path_specs[spec_id])

        test("s")
        test("h")
        test("p")
        test("sh")
        test("sp")
        test("hp")
        test("shp")

    def _test_pre_path_spec(self, endpoint, spec):
        def create_rule():
            """Create the rule from the spec info."""
            endpoint_short = "o" if endpoint == "origin" else "d"
            rule_data = {endpoint_short: spec["spec"]}
            return self.rules.create_rule(rule_data, allow=True)

        # Create and add the rule.
        rule = create_rule()
        rule.add()

        # Check if the cell text matches the expected string.
        rule_row = self._user_rule_rows[0]
        returned_string = getattr(rule_row, endpoint)
        self.assertEqual(returned_string, spec["expected_string"])

        # Remove the rule again.
        rule.remove()

    def test_origin_property(self):
        self._test_endpoint("origin")

    def test_dest_property(self):
        self._test_endpoint("dest")

    def test_origin_empty(self):
        self.rule_without_origin.add()
        origin_string = self._user_rule_rows[0].origin
        self.assertEqual(origin_string, "")

    def test_dest_empty(self):
        self.rule_without_dest.add()
        dest_string = self._user_rule_rows[0].dest
        self.assertEqual(dest_string, "")

    def test_rule_set_property(self):
        def test(rule, expected_ruleset_string):
            rule.add()
            self.assertEqual(self._user_rule_rows[0].rule_set,
                             expected_ruleset_string)
            rule.remove()

        test(self.allow_rule, "User")
        test(self.temp_allow_rule, "Temporary")

    def test_create_rule(self):
        def test(rule):
            rule.add()
            rule_row = self._user_rule_rows[0]
            returned_rule = rule_row.create_rule()
            self.assertIsInstance(returned_rule, Rule,
                                  "`create_rule()` has returned a `Rule` "
                                  "instance.")
            self.assertEqual(returned_rule, rule,
                             msg=("The returned rule is identical to what "
                                  "has been added."))
            rule.remove()

        # Test rules with all origin/dest fields specified.
        test(self.allow_rule_shp_shp)
        test(self.temp_deny_rule_shp_shp)

    def test_remove_rule(self):
        for rule in self.some_rules:
            rule.add()
            self.assertTrue(rule.exists())
            self._user_rule_rows[0].remove()
            self.assertFalse(rule.exists())

    def test_is_user_rule(self):
        def test_rule(rule, is_user_rule):
            rule.add()
            self.assertEqual(self._user_rule_rows[0].is_user_rule(),
                             is_user_rule)
            rule.remove()

        # Test some user rules, that is, both temporary and permanent rules.
        test_rule(self.allow_rule, True)
        test_rule(self.temp_allow_rule, True)

        # TODO: Test some non-user rules (subscription rules).
        #       In those cases `is_user_rule()` should return `False`.

    def test_is_temporary(self):
        def test_rule(rule, is_temp):
            rule.add()
            self.assertEqual(self._user_rule_rows[0].is_temporary(), is_temp)
            rule.remove()

        # Test both temporary and permanent rules.
        test_rule(self.allow_rule, False)
        test_rule(self.temp_allow_rule, True)


class TestAddRuleForm(YourPolicyTestCase):

    def setUp(self):
        super(TestAddRuleForm, self).setUp()

        self.input_field_values = {"allow": True, "temp": True,
                                   "origin_scheme": "os", "origin_host": "oh",
                                   "origin_port": "op", "dest_scheme": "ds",
                                   "dest_host": "dh", "dest_port": "dp"}

    def test_input_fields(self):
        def test_input_field(field_name, set_value, reset_value):
            """ Procedure:
                1. Set the input field to a value.
                2. Assertion
                3. Reset the input field.
                4. Assertion
            """
            form = self.add_rule_form
            setattr(form, field_name, set_value)
            self.assertEqual(getattr(form, field_name), set_value)
            setattr(form, field_name, reset_value)
            self.assertEqual(getattr(form, field_name), reset_value)

        test_boolean_field = partial(test_input_field, set_value=True,
                                     reset_value=False)
        test_text_field = partial(test_input_field, set_value="foo",
                                  reset_value="")

        test_boolean_field("allow")
        test_boolean_field("temp")
        test_text_field("origin_scheme")
        test_text_field("origin_host")
        test_text_field("origin_port")
        test_text_field("dest_scheme")
        test_text_field("dest_host")
        test_text_field("dest_port")

    def test_set_all_values__specifying_only_one_field(self):
        def test_one_field(field_name, value):
            # Fill all fields with some data, to see that fields not
            # specified to `set_all_values` are reset.
            self._fill_all_fields()

            # Set all fields
            self.add_rule_form.set_all_values(**{field_name: value})

            # Check all fields
            self._assert_all_fields_are_reset(ignore_fields=[field_name])
            self.assertEqual(getattr(self.add_rule_form, field_name), value,
                             ("Form field `{}` has value `{}`."
                              .format(field_name, value)))

        for field_name, value in self.input_field_values.items():
            test_one_field(field_name, value)

    def test_set_all_values__specifying_all_fields(self):
        self._fill_all_fields()

        # Set all fields
        self.add_rule_form.set_all_values(**self.input_field_values)

        # Check all fields
        for field_name, value in self.input_field_values.items():
            self.assertEqual(getattr(self.add_rule_form, field_name), value,
                             ("Form field `{}` has value `{}`."
                              .format(field_name, value)))

    def test_set_all_values_by_rule(self):

        def get_expected_field_values_from_rule(rule):
            return {"allow": rule.allow, "temp": rule.temp,
                    "origin_scheme": rule.origin_scheme or "",
                    "origin_host": rule.origin_host or "",
                    "origin_port": str(rule.origin_port or ""),
                    "dest_scheme": rule.dest_scheme or "",
                    "dest_host": rule.dest_host or "",
                    "dest_port": str(rule.dest_port or "")}

        def test_rule(rule):
            # Set all values
            self.add_rule_form.set_all_values_by_rule(rule)

            # Assertions
            expected_values = get_expected_field_values_from_rule(rule)
            for field_name, expected_field_value in expected_values.items():
                # Compare the expected value with the value returned by
                # the `AddRuleForm` property getters.
                returned_field_value = getattr(self.add_rule_form, field_name)
                self.assertEqual(returned_field_value, expected_field_value,
                                 msg=("Form field `{}` has value `{}`."
                                      .format(field_name,
                                              expected_field_value)))

        # Test some rules which make use of all fields.
        test_rule(self.allow_rule_shp_shp)
        test_rule(self.temp_deny_rule_shp_shp)

        # Test some rules which make use of _some_ fields.
        test_rule(self.allow_rule_sh_p)
        test_rule(self.temp_deny_rule_s_hp)
        test_rule(self.rule_without_dest)
        test_rule(self.rule_without_origin)

    def test_reset(self):
        # Set all fields.
        self.add_rule_form.set_all_values_by_rule(self.temp_deny_rule_shp_shp)

        # reset
        self.add_rule_form.reset()

        self._assert_all_fields_are_reset()

    def test_submit(self):
        def submit_and_compare(expected_rule):
            self.assertEqual(len(self._user_rule_rows), 0)
            self.add_rule_form.submit()
            # If `expected_rule` is None, no rule should be created.
            expected_count = 1 if expected_rule is not None else 0
            self.assertEqual(len(self._user_rule_rows), expected_count)
            if expected_count != 0:
                submitted_rule = self._user_rule_rows[0].create_rule()
                self.assertEqual(submitted_rule, expected_rule)

        def test_rule(rule):
            """ Procedure:
                (1) Fill the form using the `Rule` instance`.
                (2) Submit the form.
                (3) Get the `RuleRow` and compare its values with those
                    of the `Rule` instance.
            """
            # Fill the form.
            self.add_rule_form.set_all_values_by_rule(rule)
            # Submit and compare.
            submit_and_compare(rule)
            # Remove the rule again.
            rule.remove()

        # Test some rules which make use of all fields.
        test_rule(self.allow_rule_shp_shp)
        test_rule(self.temp_deny_rule_shp_shp)

        # Test some rules which make use of _some_ fields.
        test_rule(self.allow_rule_sh_p)
        test_rule(self.temp_deny_rule_s_hp)
        test_rule(self.rule_without_dest)
        test_rule(self.rule_without_origin)

        # If all form fields are empty, no rule should be added.
        self.add_rule_form.reset()
        submit_and_compare(None)

    def _assert_all_fields_are_reset(self, ignore_fields=[]):
        """Assert that the form is empty/reset."""

        def check_field(field_name, expected_value=""):
            if field_name in ignore_fields:
                return
            self.assertEqual(getattr(self.add_rule_form, field_name),
                             expected_value,
                             "Field `{}` is empty.".format(field_name))

        check_field("origin_scheme")
        check_field("origin_host")
        check_field("origin_port")
        check_field("dest_scheme")
        check_field("dest_host")
        check_field("dest_port")

        # The `temp` checkbox should be unchecked.
        check_field("temp", expected_value=False)

    def _fill_all_fields(self):
        """Fill all form fields with some data."""

        rule = self.arbitrary_rule_shp_shp
        self.add_rule_form.set_all_values_by_rule(rule)
