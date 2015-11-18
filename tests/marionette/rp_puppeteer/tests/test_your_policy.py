# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_ui_harness.test_data.rules import ExemplaryRules
from functools import partial


class YourPolicyTestCase(RequestPolicyTestCase):

    def setUp(self):
        super(YourPolicyTestCase, self).setUp()

        self.marionette.set_context("content")
        self.settings.your_policy.open()

        self.rules_table = self.settings.your_policy.rules_table
        self.add_rule_form = self.settings.your_policy.add_rule_form

        self.data = ExemplaryRules(lambda: self.marionette)

    def tearDown(self):
        try:
            self.rules.remove_all()
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
        self.settings.your_policy.open()
        self.assertEqual(self.marionette.get_url(),
                         "about:requestpolicy?yourpolicy")


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
        test_rule(self.data.allow_rule_shp_shp)
        test_rule(self.data.temp_deny_rule_shp_shp)

        # Test some rules which make use of _some_ fields.
        test_rule(self.data.allow_rule_sh_p)
        test_rule(self.data.temp_deny_rule_s_hp)
        test_rule(self.data.rule_without_dest)
        test_rule(self.data.rule_without_origin)

    def test_reset(self):
        # Set all fields.
        self.add_rule_form.set_all_values_by_rule(
            self.data.temp_deny_rule_shp_shp)

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
            # Remove the rule again. The rules file must be updated
            # because submitting the form has saved the rule.
            rule.remove(store=True)

        # Test some rules which make use of all fields.
        test_rule(self.data.allow_rule_shp_shp)
        test_rule(self.data.temp_deny_rule_shp_shp)

        # Test some rules which make use of _some_ fields.
        test_rule(self.data.allow_rule_sh_p)
        test_rule(self.data.temp_deny_rule_s_hp)
        test_rule(self.data.rule_without_dest)
        test_rule(self.data.rule_without_origin)

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

        rule = self.data.arbitrary_rule_shp_shp
        self.add_rule_form.set_all_values_by_rule(rule)
