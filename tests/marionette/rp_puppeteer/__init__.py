# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

from .decorators import use_class_as_property


class RequestPolicyPuppeteer(object):
    """The puppeteer class is used to expose libraries to test cases.

    Each library can be referenced by its puppeteer name as a member of a
    RequestPolicyTestCase instance.
    """

    @use_class_as_property('api.prefs.Preferences')
    def prefs(self):
        pass

    @use_class_as_property('api.rules.Rules')
    def rules(self):
        pass

    @use_class_as_property('ui.context_menu.ContextMenu')
    def ctx_menu(self):
        pass

    @use_class_as_property('ui.redirect_notification.RedirectNotification')
    def redir(self):
        pass

    @use_class_as_property('ui.tabs.Tabs')
    def tabs(self):
        pass

    @use_class_as_property('ui.web_utils.WebUtils')
    def web_utils(self):
        pass
