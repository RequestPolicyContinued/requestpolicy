# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class TestPrefs(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)

        self.new_pref = 'marionette.unittest.using_pref'

    def test_using_pref(self):
        self.assertEqual(self.prefs.get_pref(self.new_pref), None,
                         msg="The pref initially doesn't exist.")

        with self.prefs.using_pref(self.new_pref, 'unittest'):
            self.assertEqual(self.prefs.get_pref(self.new_pref), 'unittest',
                             msg="The pref has been set.")

        self.assertEqual(self.prefs.get_pref(self.new_pref), None,
                         msg="The pref has been removed.")


class TestOldRulesPrefs(RequestPolicyTestCase):

    def setUp(self):
        super(TestOldRulesPrefs, self).setUp()

        self.old_rules = self.prefs.old_rules

    def tearDown(self):
        try:
            self.old_rules.remove_all_prefs()
        finally:
            super(TestOldRulesPrefs, self).tearDown()

    def test_remove_all_prefs(self):
        self.old_rules.set_rules(self._data)
        self.old_rules.remove_all_prefs()
        self.assertDictEqual(self.old_rules.get_rules(),
                             self._data__prefs_removed)

    def test_empty_all_prefs(self):
        self.old_rules.set_rules(self._data)
        self.old_rules.empty_all_prefs()
        self.assertDictEqual(self.old_rules.get_rules(),
                             self._data__prefs_empty)

    def test_set_and_get_rules(self):
        self.old_rules.set_rules(self._data)
        self.assertDictEqual(self.old_rules.get_rules(), self._data)

    def test_set_rules__not_all(self):
        # Fill all prefs with some values.
        self.old_rules.set_rules(self._data)
        # Set only some values
        self.old_rules.set_rules({
            "allowedOrigins": self._data["allowedOrigins"]
        })
        expected_rules = self._data__prefs_empty
        expected_rules["allowedOrigins"] = self._data["allowedOrigins"]
        self.assertDictEqual(self.old_rules.get_rules(), expected_rules,
                             "The unspecified prefs have been emptied.")

    #===========================================================================
    # Test Getter/Setter properties
    #===========================================================================

    def test_set_origin_rules(self):
        self.old_rules.origin_rules = "mozilla.org"
        expected_rules = self._data__prefs_removed
        expected_rules["allowedOrigins"] = "mozilla.org"
        self.assertDictEqual(self.old_rules.get_rules(), expected_rules)

    def test_set_dest_rules(self):
        self.old_rules.dest_rules = "mozilla.net"
        expected_rules = self._data__prefs_removed
        expected_rules["allowedDestinations"] = "mozilla.net"
        self.assertDictEqual(self.old_rules.get_rules(), expected_rules)

    def test_set_origin_to_dest_rules(self):
        self.old_rules.origin_to_dest_rules = "mozilla.org|mozilla.net"
        expected_rules = self._data__prefs_removed
        expected_rules["allowedOriginsToDestinations"] = "mozilla.org|mozilla.net"
        self.assertDictEqual(self.old_rules.get_rules(), expected_rules)

    def test_get_origin_rules(self):
        self.old_rules.set_rules(self._data)
        self.assertEqual(self.old_rules.origin_rules, "mozilla.org")

    def test_get_dest_rules(self):
        self.old_rules.set_rules(self._data)
        self.assertEqual(self.old_rules.dest_rules, "mozilla.net")

    def test_get_origin_to_dest_rules(self):
        self.old_rules.set_rules(self._data)
        self.assertEqual(self.old_rules.origin_to_dest_rules,
                         "mozilla.org|mozilla.net")

    @property
    def _data(self):
        return {"allowedOrigins": "mozilla.org",
                "allowedDestinations": "mozilla.net",
                "allowedOriginsToDestinations": "mozilla.org|mozilla.net"}

    @property
    def _data__prefs_removed(self):
        return {"allowedOrigins": None, "allowedDestinations": None,
                "allowedOriginsToDestinations": None}

    @property
    def _data__prefs_empty(self):
        return {"allowedOrigins": "", "allowedDestinations": "",
                "allowedOriginsToDestinations": ""}
