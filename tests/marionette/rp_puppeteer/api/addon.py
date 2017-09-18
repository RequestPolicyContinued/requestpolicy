# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette_driver.wait import Wait
from firefox_puppeteer.base import BaseLib
from contextlib import contextmanager
import time
import os


class Addon(BaseLib):
    """Class to install/uninstall/enable/disable an Add-On."""

    sandbox = "rp-puppeteer-addons"

    def __init__(self, marionette_getter, addon_id, install_url):
        super(Addon, self).__init__(marionette_getter)
        self.addon_id = addon_id
        self.install_url = install_url

    #################################
    # Public Properties and Methods #
    #################################

    def install(self):
        with self._addon_install():
            # Start installing.
            self.marionette.execute_script("""
              var globalScope = this;
              globalScope.addonInstall.install();
            """, sandbox=self.sandbox, new_sandbox=False)

            def is_installation_finished(_):
                return self.marionette.execute_script("""
                  Components.utils.import("resource://gre/modules/AddonManager.jsm");

                  var globalScope = this;
                  var state = globalScope.addonInstall.state;
                  return state === AddonManager.STATE_INSTALLED;
                """, sandbox=self.sandbox, new_sandbox=False)

            # Wait until installed.
            Wait(self.marionette).until(is_installation_finished)

    def uninstall(self):
        with self._addon():
            return self.marionette.execute_script("""
              var globalScope = this;
              var addon = globalScope.addon;

              if (addon !== null) {
                addon.uninstall();
              }
            """, sandbox=self.sandbox, new_sandbox=False)

        Wait(self.marionette).until(lambda _: not self.is_installed)

    def enable(self):
        self._set_user_disabled(False)
        Wait(self.marionette).until(lambda _: self.is_active)

    def disable(self):
        self._set_user_disabled(True)
        Wait(self.marionette).until(lambda _: not self.is_active)

    @contextmanager
    def tmp_disabled(self):
        self.disable()
        try:
            yield
        finally:
            self.enable()

    @property
    def is_installed(self):
        with self._addon():
            return self.marionette.execute_script("""
              Components.utils.import("resource://gre/modules/AddonManager.jsm");

              var globalScope = this;
              var addon = globalScope.addon;

              if (addon !== null) {
                return true;
              }
              return false;
            """, sandbox=self.sandbox, new_sandbox=False)

    @property
    def is_active(self):
        with self._addon():
            return self.marionette.execute_script("""
              var globalScope = this;
              var addon = globalScope.addon;

              if (addon !== null) {
                return addon.isActive;
              }
              return false;
            """, sandbox=self.sandbox, new_sandbox=False)

    ##################################
    # Private Properties and Methods #
    ##################################

    @contextmanager
    def _addon(self):
        """Provide an `Addon` object in the sandbox."""

        self.marionette.execute_script(
            """
              Components.utils.import("resource://gre/modules/AddonManager.jsm");

              var addonID = arguments[0];

              var globalScope = this;
              globalScope.addon = null;
              globalScope.addonCallbackCalled = false;

              var addonCallback = function (addon) {
                globalScope.addon = addon;
                globalScope.addonCallbackCalled = true;
              };

              AddonManager.getAddonByID(addonID, addonCallback);
            """,
            sandbox=self.sandbox,
            new_sandbox=False,
            script_args=[self.addon_id]
        )

        self._wait_until_true("addonCallbackCalled")

        try:
            yield
        finally:
            # Cleanup
            self.marionette.execute_script("""
              var globalScope = this;
              delete globalScope.addon;
              delete globalScope.addonCallbackCalled;
            """, sandbox=self.sandbox, new_sandbox=False)

    @contextmanager
    def _addon_install(self):
        """Provide an `AddonInstall` object in the sandbox."""

        self.marionette.execute_script(
            """
              Components.utils.import("resource://gre/modules/AddonManager.jsm");

              var installUrl = arguments[0];

              var globalScope = this;
              globalScope.addonInstall = null;
              globalScope.installCallbackCalled = false;

              var installCallback = function (addonInstall) {
                globalScope.addonInstall = addonInstall;
                globalScope.installCallbackCalled = true;
              };

              AddonManager.getInstallForURL(installUrl, installCallback,
                                            "application/x-xpinstall");
            """,
            sandbox=self.sandbox,
            new_sandbox=False,
            script_args=[self.install_url]
        )

        self._wait_until_true("installCallbackCalled")

        try:
            yield
        finally:
            # Cleanup
            self.marionette.execute_script("""
              var globalScope = this;
              delete globalScope.addonInstall;
              delete globalScope.installCallbackCalled;
            """, sandbox=self.sandbox, new_sandbox=False)

    def _wait_until_true(self, variable_name):
        def is_true(_):
            return self.marionette.execute_script(
                """
                  var globalScope = this;
                  return globalScope[arguments[0]] === true;
                """, sandbox=self.sandbox, new_sandbox=False,
                script_args=[variable_name])

        Wait(self.marionette).until(is_true)

    def _set_user_disabled(self, value):
        assert isinstance(value, bool)
        with self._addon():
            return self.marionette.execute_script("""
              var globalScope = this;
              var addon = globalScope.addon;

              if (addon !== null) {
                addon.userDisabled = arguments[0];
              }
            """, sandbox=self.sandbox, new_sandbox=False, script_args=[value])


class RequestPolicy(Addon):
    """Class to install/uninstall/enable/disable RequestPolicy."""

    def __init__(self, marionette_getter):
        install_url = ("file://{}/dist/requestpolicy-legacy-ui-testing.xpi"
                       .format(os.getcwd()))

        Addon.__init__(self, marionette_getter,
                       addon_id="rpcontinued@non-amo.requestpolicy.org",
                       install_url=install_url)

    #################################
    # Public Properties and Methods #
    #################################

    def disable(self):
        # FIXME: issue #728
        time.sleep(0.2)

        super(RequestPolicy, self).disable()
