# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


def get_gecko_log_error_lines(file):
    from rp_puppeteer.api.gecko_log_parser import GeckoLogParser
    parser = GeckoLogParser(file)
    return parser.get_all_error_lines(return_expected_as_well=False)
