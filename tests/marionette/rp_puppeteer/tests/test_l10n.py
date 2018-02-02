# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette import SkipTest


class TestL10n(RequestPolicyTestCase):

    def test_get_rp_entity(self):
        # Since the *.dtd files only contain strings for the Request Log,
        # this test requires a Request-Log-API.
        raise SkipTest("ToDo")

    def test_get_rp_property(self):
        raise SkipTest("L10n is no working right now")

        prop_id = "preferences"

        with self.marionette.using_context("content"):
            self.marionette.navigate("about:requestpolicy?basicprefs")
            el = self.marionette.find_element("id", prop_id)
            self.assertEqual(el.text, self.l10n.get_rp_property(prop_id))
