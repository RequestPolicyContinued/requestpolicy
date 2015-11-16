# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from rp_ui_harness.decorators import lazyprop
from marionette.marionette_test import SkipTest


PREF_PREFIX = "extensions.requestpolicy."
PREF_DEFAULT_ALLOW = PREF_PREFIX + "defaultPolicy.allow"
PREF_WELCOME_WIN_SHOWN = PREF_PREFIX + "welcomeWindowShown"
PREF_LAST_RP_VERSION = PREF_PREFIX + "lastVersion"


class RulesImportTestCase(RequestPolicyTestCase):

    def tearDown(self):
        try:
            for pref in ("allowedOriginsToDestinations",
                         "allowedOrigins",
                         "allowedDestinations"):
                self.prefs.reset_pref(PREF_PREFIX + pref)
            self.rules.remove_all()
        finally:
            super(RulesImportTestCase, self).tearDown()

    @lazyprop
    def _typical_rules(self):
        return {
            "v0": {
                "allowedOriginsToDestinations": (
                    "https://www.mozilla.org|https://mozorg.cdn.mozilla.net "
                    "www.mozilla.org|mozorg.cdn.mozilla.net "
                    "mozilla.org|mozilla.net"
                ),
                "allowedOrigins": (
                    "https://www.mozilla.org "
                    "www.mozilla.org "
                    "mozilla.org"
                ),
                "allowedDestinations": (
                    "https://mozorg.cdn.mozilla.net "
                    "mozorg.cdn.mozilla.net "
                    "mozilla.net"
                )
            },
            "expected": [
                # origin-to-destination rules
                self._rule({"o": {"s": "https", "h": "*.www.mozilla.org"},
                            "d": {"s": "https", "h": "*.mozorg.cdn.mozilla.net"}}),
                self._rule({"o": {"h": "*.www.mozilla.org"},
                            "d": {"h": "*.mozorg.cdn.mozilla.net"}}),
                self._rule({"o": {"h": "*.mozilla.org"},
                            "d": {"h": "*.mozilla.net"}}),
                # origin rules
                self._rule({"o": {"s": "https", "h": "*.www.mozilla.org"}}),
                self._rule({"o": {"h": "*.www.mozilla.org"}}),
                self._rule({"o": {"h": "*.mozilla.org"}}),
                # destination rules
                self._rule({"d": {"s": "https", "h": "*.mozorg.cdn.mozilla.net"}}),
                self._rule({"d": {"h": "*.mozorg.cdn.mozilla.net"}}),
                self._rule({"d": {"h": "*.mozilla.net"}})
            ]
        }

    def _add_legacy_rules(self, rules):
        """Add the rules for v0.*.*."""

        for (pref, value) in rules.items():
            self.prefs.set_pref(PREF_PREFIX + pref, value)

    def _rule(self, rule_data):
        return self.rules.create_rule(rule_data, allow=True, temp=False)


class TestAutomaticRulesImportOnUpgrade(RulesImportTestCase):

    def test_autoimport__usual_first_upgrade(self):
        self._test_autoimport_or_not(is_upgrade=True,
                                     with_existing_rules_file=False,
                                     with_welcomewin=True,
                                     should_autoimport=True)

    def test_autoimport__upgrade_without_welcomewin(self):
        raise SkipTest("FIXME: issue #731")
        self._test_autoimport_or_not(is_upgrade=True,
                                     with_existing_rules_file=False,
                                     with_welcomewin=False,
                                     should_autoimport=True)

    def test_no_autoimport__rules_file_removed(self):
        self._test_autoimport_or_not(is_upgrade=False,
                                     with_existing_rules_file=False,
                                     with_welcomewin=True,
                                     should_autoimport=False)

    def test_no_autoimport__upgrade_with_existing_rules_file(self):
        raise SkipTest("FIXME: issue #731")
        self._test_autoimport_or_not(is_upgrade=True,
                                     with_existing_rules_file=True,
                                     with_welcomewin=True,
                                     should_autoimport=False)

    def _test_autoimport_or_not(self, is_upgrade, with_existing_rules_file,
                                with_welcomewin, should_autoimport):
        rules = self._typical_rules

        if with_existing_rules_file:
            # Ensure that a user.json file exists.
            self.rules.save()

        last_rp_version = "0.5.28" if is_upgrade else "1.0.beta9"

        with self.rp_addon.tmp_disabled():
            if not with_existing_rules_file:
                self.rules_file.remove()
            self.prefs.set_pref(PREF_LAST_RP_VERSION, last_rp_version)
            self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, not with_welcomewin)

            self._add_legacy_rules(rules["v0"])

        expected_rules = rules["expected"] if should_autoimport else []
        self.assertListEqual(sorted(self.rules.get_rules()),
                             sorted(expected_rules))

        if with_welcomewin:
            # Close the setup tab.
            self.browser.tabbar.tabs[-1].close()
