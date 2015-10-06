# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.api.l10n import L10n as FxL10n


class L10n(FxL10n):
    """Subclass of Firefox Puppeteer's L10n class to provide methods without
    specifying the l10n file.
    """

    def get_rp_property(self, property_id):
        property_urls = ["chrome://rpcontinued/locale/requestpolicy.properties"]
        return FxL10n.get_property(self, property_urls, property_id)

    def get_rp_entity(self, dtd_id):
        dtd_urls = ["chrome://rpcontinued/locale/requestpolicy.dtd"]
        return FxL10n.get_entity(self, dtd_urls, dtd_id)
