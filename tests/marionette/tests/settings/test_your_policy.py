# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette_driver.errors import NoSuchElementException
from rp_ui_harness.test_data.rules import ExemplaryOldRules


class TestYourPolicy(RequestPolicyTestCase):

    def setUp(self):
        super(TestYourPolicy, self).setUp()

        self.marionette.set_context("content")
        self.settings.your_policy.open()

    def tearDown(self):
        try:
            self.marionette.set_context("chrome")
        finally:
            super(TestYourPolicy, self).tearDown()

    def test_link_to_oldrules(self):
        def assert_visibility(should_be_displayed):
            try:
                link = (self.marionette
                        .find_element("css selector",
                                      "a[href='about:requestpolicy?oldrules']"))
                self.assertEqual(link.is_displayed(), should_be_displayed)
            except NoSuchElementException:
                if should_be_displayed:
                    self.fail("The link should exist.")

        # Add old rules.
        typical_rules = (ExemplaryOldRules(lambda: self.marionette)
                         .typical_rules)
        self.prefs.old_rules.set_rules(typical_rules["v0"])
        self.settings.your_policy.open()
        assert_visibility(True)

        # Remove the rules.
        self.prefs.old_rules.remove_all_prefs()
        self.settings.your_policy.open()
        assert_visibility(False)
