# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase
from marionette import SkipTest
from rp_ui_harness.utils import redirections


PREF_DEFAULT_ALLOW = "extensions.requestpolicy.defaultPolicy.allow"


class TestLinkClickRedirect(RequestPolicyTestCase):

    def tearDown(self):
        try:
            self.prefs.reset_pref(PREF_DEFAULT_ALLOW)
        finally:
            super(TestLinkClickRedirect, self).tearDown()

    ################
    # Test Methods #
    ################

    def test_r21n_appears_or_not__no_rules(self):
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        def test((test_url, _, dest_url), info):
            if info["is_same_host"]:
                self._test_no_appear(test_url, dest_url, info)
            else:
                self._test_appear(test_url, dest_url, info)
        redirections.for_each_possible_redirection_scenario(test, "link")

    def test_r21n_no_appears__conflicting_rules(self):
        self.prefs.set_pref(PREF_DEFAULT_ALLOW, True)

        self.rules.create_rule({"o": {"h": "*.maindomain.test"},
                                "d": {"h": "*.otherdomain.test"}},
                               allow=True).add()
        self.rules.create_rule({"d": {"h": "*.otherdomain.test"}},
                               allow=False).add()

        def test((test_url, _, dest_url), info):
            self._test_no_appear(test_url, dest_url, info)
        redirections.for_each_possible_redirection_scenario(test, "link")

        self.rules.remove_all()

    def test_r21n_appear_then_no_appear(self):
        raise SkipTest("FIXME")
        # When fixed, the `append_random_querystring` option in
        # some redirections-utils functions can be removed.

        self.prefs.set_pref(PREF_DEFAULT_ALLOW, False)

        rule = self.rules.create_rule({"o": {"h": "*.maindomain.test"},
                                       "d": {"h": "*.otherdomain.test"}},
                                      allow=True)

        def test((test_url, _, dest_url), info):
            if not info["is_same_host"]:
                return

            self._test_appear(test_url, dest_url, info)
            rule.add()
            self._test_no_appear(test_url, dest_url, info)
            rule.remove()

        redirections.for_each_possible_redirection_scenario(test, "link")

    ##########################
    # Private Helper Methods #
    ##########################

    def _test_no_appear(self, test_url, dest_url, info):
        self._open_page_and_click_on_first_link(test_url)

        self.assertFalse(self.redir.is_shown(),
                         "There's no redirect notification.")
        redirections.wait_until_url_load(self, dest_url)
        self.assertFalse(self.redir.is_shown(),
                         "There's no redirect notification.")

    def _test_appear(self, test_url, dest_url, info):
        self._open_page_and_click_on_first_link(test_url)

        self.assertTrue(self.redir.is_shown(),
                        "The redirect notification has been displayed.")
        redirections.assert_url_does_not_load(
            self, dest_url,
            expected_delay=info["delay"])

        self.redir.close()

    def _open_page_and_click_on_first_link(self, test_url):
        with self.marionette.using_context("content"):
            self.marionette.navigate(test_url)
            link = self.marionette.find_element("tag name", "a")
            link.click()
