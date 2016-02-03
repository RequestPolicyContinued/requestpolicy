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

    def test_open(self):
        self.marionette.navigate("about:blank")
        self.assertNotEqual(self.marionette.get_url(),
                            "about:requestpolicy?subscriptions")
        self.settings.subscriptions.open()
        self.assertEqual(self.marionette.get_url(),
                         "about:requestpolicy?subscriptions")

    def test_enable_disable(self):
        def test(sub_name):
            self.assertFalse(self.settings.subscriptions.is_enabled(sub_name))
            self.settings.subscriptions.enable(sub_name)
            self.assertTrue(self.settings.subscriptions.is_enabled(sub_name))
            self.settings.subscriptions.disable(sub_name)
            self.assertFalse(self.settings.subscriptions.is_enabled(sub_name))

        self.settings.subscriptions.open()
        self.settings.subscriptions.disable_all()

        test("allow_embedded")
        test("allow_extensions")
        test("allow_functionality")
        test("allow_mozilla")
        test("allow_sameorg")
        test("deny_trackers")
