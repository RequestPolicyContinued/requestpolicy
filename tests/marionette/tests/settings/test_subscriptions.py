# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


class TestSubscriptionsSettings(RequestPolicyTestCase):

    def setUp(self):
        super(TestSubscriptionsSettings, self).setUp()
        self.marionette.set_context("content")

    def tearDown(self):
        try:
            self.marionette.set_context("chrome")
        finally:
            super(TestSubscriptionsSettings, self).tearDown()

    ################
    # Test Methods #
    ################

    def test_subscription_contains_rules(self):
        def count_rules():
            return self.settings.your_policy.rules_table.count_rules()

        def test(sub_name):
            # assert no rules
            self.settings.your_policy.open()
            self.assertEqual(0, count_rules())

            # enable
            self.settings.subscriptions.open()
            self.settings.subscriptions.enable(sub_name)

            # assert rules
            self.settings.your_policy.open()
            self.assertGreater(count_rules(), 0)

            # disable
            self.settings.subscriptions.open()
            self.settings.subscriptions.disable(sub_name)

            # assert no rules
            self.settings.your_policy.open()
            self.assertEqual(0, count_rules())

        self.settings.subscriptions.open()
        self.settings.subscriptions.disable_all()

        test("allow_functionality")
        test("allow_sameorg")
        test("deny_trackers")
