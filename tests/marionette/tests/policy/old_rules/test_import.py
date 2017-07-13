# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette.marionette_test import SkipTest
from rp_ui_harness.test_data.rules import ExemplaryOldRules


PREF_PREFIX = "extensions.requestpolicy."
PREF_DEFAULT_ALLOW = PREF_PREFIX + "defaultPolicy.allow"
PREF_WELCOME_WIN_SHOWN = PREF_PREFIX + "welcomeWindowShown"
PREF_LAST_RP_VERSION = PREF_PREFIX + "lastVersion"


class RulesImportTestCase(RequestPolicyTestCase):

    def setUp(self):
        super(RulesImportTestCase, self).setUp()

        typical_rules = (ExemplaryOldRules(lambda: self.marionette)
                         .typical_rules)
        self.oldrules_prefs = typical_rules["v0"]
        self.oldrules_rules = typical_rules["expected"]

    def tearDown(self):
        try:
            self.prefs.old_rules.remove_all_prefs()
            self.rules.remove_all(store=True)
        finally:
            super(RulesImportTestCase, self).tearDown()


class TestAutomaticRulesImportOnUpgrade(RulesImportTestCase):

    def test_autoimport__usual_first_upgrade(self):
        self._test_autoimport_or_not(last_rp_version="0.5.28",
                                     with_existing_rules_file=False,
                                     welcomewin_shown=False,
                                     should_autoimport=True)

    def test_autoimport__usual_first_upgrade_without_last_rp_version(self):
        self._test_autoimport_or_not(last_rp_version=None,
                                     with_existing_rules_file=False,
                                     welcomewin_shown=False,
                                     should_autoimport=True)

    def test_autoimport__upgrade_without_welcomewin(self):
        self._test_autoimport_or_not(last_rp_version="0.5.28",
                                     with_existing_rules_file=False,
                                     welcomewin_shown=True,
                                     should_autoimport=True)

    def test_no_autoimport__rules_file_removed(self):
        self._test_autoimport_or_not(last_rp_version="1.0.beta9",
                                     with_existing_rules_file=False,
                                     welcomewin_shown=False,
                                     should_autoimport=False)

    def test_no_autoimport__upgrade_with_existing_rules_file(self):
        self._test_autoimport_or_not(last_rp_version="0.5.28",
                                     with_existing_rules_file=True,
                                     welcomewin_shown=False,
                                     should_autoimport=False)

    def _test_autoimport_or_not(self, last_rp_version, with_existing_rules_file,
                                welcomewin_shown, should_autoimport):
        if with_existing_rules_file:
            # Ensure that a user.json file exists.
            self.rules.save()

        with self.rp_addon.tmp_disabled():
            if not with_existing_rules_file:
                self.rules_file.remove()
            if last_rp_version is None:
                self.prefs.reset_pref(PREF_LAST_RP_VERSION)
            else:
                self.prefs.set_pref(PREF_LAST_RP_VERSION, last_rp_version)
            self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, welcomewin_shown)

            self.prefs.old_rules.set_rules(self.oldrules_prefs)

        expected_rules = self.oldrules_rules if should_autoimport else []
        self.assertListEqual(sorted(self.rules.get_rules()),
                             sorted(expected_rules))

        if not welcomewin_shown:
            # Close the setup tab.
            self.browser.tabbar.tabs[-1].close()


class TestImportPage(RulesImportTestCase):

    def test_import(self):
        # Add some "old rules".
        self.prefs.old_rules.set_rules(self.oldrules_prefs)

        with self.marionette.using_context("content"):
            self.settings.old_rules.open()
            self.settings.old_rules.show_rules()

            # Check the rule rows.
            rule_rows = self.settings.old_rules.rules_table.all_rule_rows
            displayed_rules = [row.create_rule() for row in rule_rows]
            self.assertListEqual(sorted(displayed_rules),
                                 sorted(self.oldrules_rules))

            # Import and compare.
            self.settings.old_rules.import_rules()
            self.assertListEqual(sorted(self.rules.get_rules()),
                                 sorted(self.oldrules_rules))
