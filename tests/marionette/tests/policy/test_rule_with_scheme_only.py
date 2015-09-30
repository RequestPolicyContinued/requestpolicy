# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase


TEST_URL = "http://www.maindomain.test/scheme-unknown-and-without-host-2.html"
PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"
SCHEME = "rpc"
RULE_DATA = {"d": {"s": SCHEME}}


class TestRuleWithSchemeOnly(RequestPolicyTestCase):

    def setUp(self):
        RequestPolicyTestCase.setUp(self)
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        self.allow_rule = self.rules.create_rule(allow=True,
                                                 rule_data=RULE_DATA)
        self.deny_rule = self.rules.create_rule(allow=False,
                                                rule_data=RULE_DATA)

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
            self.rules.remove_all()
        finally:
            RequestPolicyTestCase.tearDown(self)

    def test_default_deny(self):
        self._run_test_case(is_default_allow=False,
                            allow_rule_exists=False,
                            deny_rule_exists=False,
                            request_should_be_allowed=False)

    def test_default_deny_with_allow_rule(self):
        self._run_test_case(is_default_allow=False,
                            allow_rule_exists=True,
                            deny_rule_exists=False,
                            request_should_be_allowed=True)

    def test_default_allow(self):
        self._run_test_case(is_default_allow=True,
                            allow_rule_exists=False,
                            deny_rule_exists=False,
                            request_should_be_allowed=True)

    def test_default_allow_with_deny_rule(self):
        self._run_test_case(is_default_allow=True,
                            allow_rule_exists=False,
                            deny_rule_exists=True,
                            request_should_be_allowed=False)

    def _run_test_case(self, is_default_allow, allow_rule_exists,
                       deny_rule_exists, request_should_be_allowed):
        #=======================================================================
        # Set up the test case
        #=======================================================================
        # Default policy.
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, is_default_allow)

        # Add the rules.
        if (allow_rule_exists):
            self.allow_rule.add()
        if (deny_rule_exists):
            self.deny_rule.add()

        #=======================================================================
        # Navigate to the test page and record requests.
        #=======================================================================
        with self.requests.listen():
            with self.marionette.using_context("content"):
                self.marionette.navigate(TEST_URL)
                iframe_uri = (
                    self.marionette
                    .find_element("tag name", "iframe")
                    .get_attribute("src")
                )

        #=======================================================================
        # Assertions
        #=======================================================================
        self.assertTrue(iframe_uri.startswith(SCHEME + ":"),
                        "The iframe's URI starts with scheme '%s'." % SCHEME)

        matching_requests = filter(lambda r: r["dest"] == iframe_uri,
                                   self.requests.all)
        self.assertEqual(len(matching_requests), 1,
                         ("There has been exactly one request to '%s'."
                          % iframe_uri))

        # Check the decision (allow or deny) on the request
        self.assertEqual(matching_requests[0]["isAllowed"],
                         request_should_be_allowed)
