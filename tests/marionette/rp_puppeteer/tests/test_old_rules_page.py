# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from rp_puppeteer.ui.settings.rules_table import RulesTable
from rp_ui_harness.test_data.rules import ExemplaryOldRules


PREF_PREFIX = "extensions.requestpolicy."


class TestOldRulesPage(RequestPolicyTestCase):

    def setUp(self):
        super(TestOldRulesPage, self).setUp()

        self.typical_rules = (ExemplaryOldRules(lambda: self.marionette)
                              .typical_rules)
        self.prefs.old_rules.set_rules(self.typical_rules["v0"])

        self.marionette.set_context("content")
        self.settings.old_rules.open()

    def tearDown(self):
        try:
            self.prefs.old_rules.remove_all_prefs()
            self.rules.remove_all()
            self.marionette.set_context("chrome")
        finally:
            super(TestOldRulesPage, self).tearDown()

    ################
    # Test Methods #
    ################

    def test_rules_table(self):
        rules_table = self.settings.old_rules.rules_table
        self.assertIsInstance(rules_table, RulesTable)

    def test_open(self):
        self.marionette.navigate("about:blank")
        self.assertNotEqual(self.marionette.get_url(),
                            "about:requestpolicy?oldrules")
        self.settings.old_rules.open()
        self.assertEqual(self.marionette.get_url(),
                         "about:requestpolicy?oldrules")

    def test_show_rules(self):
        rule_rows = self.settings.old_rules.rules_table.all_rule_rows
        self.assertEqual(len(rule_rows), len(self.typical_rules["expected"]))

        self.assertFalse(rule_rows[0].element.is_displayed())
        self.settings.old_rules.show_rules()
        self.assertTrue(rule_rows[0].element.is_displayed())

    def test_import_rules(self):
        self.settings.old_rules.show_rules()
        self.settings.old_rules.import_rules()
        self.assertListEqual(sorted(self.rules.all),
                             sorted(self.typical_rules["expected"]))

    def test_delete_old_rules(self):
        self.settings.old_rules.delete_old_rules()

        old_rules_prefs = self.prefs.old_rules
        self.assertIsNone(old_rules_prefs.origin_rules)
        self.assertIsNone(old_rules_prefs.dest_rules)
        self.assertIsNone(old_rules_prefs.origin_to_dest_rules)
