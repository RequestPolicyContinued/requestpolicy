# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase

from rp_puppeteer.api.prefs import using_pref


class TestPrefs(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)

        self.new_pref = 'marionette.unittest.using_pref'

    def test_using_pref(self):
        self.assertEqual(self.prefs.get_pref(self.new_pref), None,
                         msg="The pref initially doesn't exist.")

        with using_pref(self.prefs, self.new_pref, 'unittest'):
            self.assertEqual(self.prefs.get_pref(self.new_pref), 'unittest',
                             msg="The pref has been set.")

        self.assertEqual(self.prefs.get_pref(self.new_pref), None,
                         msg="The pref has been removed.")
