# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase

PREF_PREFIX = "extensions.requestpolicy."
PREF_DEFAULT_ALLOW = PREF_PREFIX + "defaultPolicy.allow"
PREF_DEFAULT_ALLOWSAMEDOMAIN = PREF_PREFIX + "defaultPolicy.allowSameDomain"
PREF_WELCOME_WIN_SHOWN = PREF_PREFIX + "welcomeWindowShown"
PREF_LAST_RP_VERSION = PREF_PREFIX + "lastVersion"
PREF_IDENT_LEVEL = PREF_PREFIX + "uriIdentificationLevel"


class TestDefaultPolicy(RequestPolicyTestCase):

    # ident levels:
    # 1: base domain
    # 2: full host
    # 3: full pre-path

    def test_after_upgrade__typical(self):
        self._test(is_upgrade=True, with_welcomewin=True, ident_level=1,
                   expected_defaultpolicy_allow=False,
                   expected_defaultpolicy_allowsamedomain=True)

    def test_after_upgrade__ident_2(self):
        self._test(is_upgrade=True, with_welcomewin=True, ident_level=2,
                   expected_defaultpolicy_allow=False,
                   expected_defaultpolicy_allowsamedomain=False)

    def test_after_upgrade__ident_3(self):
        self._test(is_upgrade=True, with_welcomewin=True, ident_level=3,
                   expected_defaultpolicy_allow=False,
                   expected_defaultpolicy_allowsamedomain=False)

    def test_new_install__typical(self):
        self._test(is_upgrade=False, with_welcomewin=True, ident_level=None,
                   expected_defaultpolicy_allow=True,
                   expected_defaultpolicy_allowsamedomain=True)

    def _test(self, is_upgrade, with_welcomewin, ident_level,
              expected_defaultpolicy_allow,
              expected_defaultpolicy_allowsamedomain):
        last_rp_version = "0.5.28" if is_upgrade else "0.0"

        # Don't know why this is necessary here... Without the sleep,
        # strange errors are thrown, like "rpPrefBranch is undefined".
        import time; time.sleep(.1)

        with self.rp_addon.tmp_disabled():
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
            self.prefs.reset_pref(PREF_DEFAULT_ALLOWSAMEDOMAIN)

            self.prefs.set_pref(PREF_LAST_RP_VERSION, last_rp_version)
            self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, not with_welcomewin)
            if ident_level is not None:
                self.prefs.set_pref(PREF_IDENT_LEVEL, ident_level)

        self.assertEqual(expected_defaultpolicy_allow,
                         self.prefs.get_pref(PREF_DEFAULT_ALLOW))
        self.assertEqual(expected_defaultpolicy_allowsamedomain,
                         self.prefs.get_pref(PREF_DEFAULT_ALLOWSAMEDOMAIN))

        if with_welcomewin:
            # Close the setup tab.
            self.browser.tabbar.tabs[-1].close()
