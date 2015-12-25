# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from rp_puppeteer.decorators import use_class_as_property


class Settings(BaseLib):

    @use_class_as_property('ui.settings.old_rules.OldRulesPage')
    def old_rules(self):
        pass

    @use_class_as_property('ui.settings.subscriptions.SubscriptionsSettings')
    def subscriptions(self):
        pass

    @use_class_as_property('ui.settings.your_policy.YourPolicy')
    def your_policy(self):
        pass
