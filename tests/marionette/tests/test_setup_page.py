# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness import RequestPolicyTestCase
from marionette_driver.wait import Wait
from rp_puppeteer.ui.addons import RequestPolicy


PREF_WELCOME_WIN_SHOWN = "extensions.requestpolicy.welcomeWindowShown"


class TestSetupPageShowingUp(RequestPolicyTestCase):
    def _get_setup_tab(self):
        # TODO: Search in all windows for setup tabs.
        #       Assert there isn't more than one setup tab.

        tab = self.browser.tabbar.selected_tab
        if tab.location == "about:requestpolicy?setup":
            return tab
        else:
            return None


    def test_on_install(self):
        rp = RequestPolicy(lambda: self.marionette)
        rp.remove()

        self.prefs.set_pref(PREF_WELCOME_WIN_SHOWN, False)

        with rp.install_in_two_steps():
            setup_tab = Wait(self.marionette).until(
                lambda m: self._get_setup_tab(),
                message="RequestPolicy has opened its Setup page.")
            self.assertTrue(self.prefs.get_pref(PREF_WELCOME_WIN_SHOWN),
                            msg=("The 'welcome window shown' pref has "
                                 "been set to `true`."))
            self.assertTrue(setup_tab.selected,
                            msg="The setup tab is selected.")
            setup_tab.close()
