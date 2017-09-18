# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_utils import constants as C


def get_gecko_log_error_lines(file):
    from rp_puppeteer.api.gecko_log_parser import GeckoLogParser
    parser = GeckoLogParser(file)
    return parser.get_all_error_lines(return_expected_as_well=False)


def create_profile(addons, pref_categories, profile=None):
    from mozprofile.prefs import Preferences
    from mozprofile.profile import Profile
    from subprocess import check_output

    prefs = Preferences()
    for category in pref_categories:
        prefs.add_file("{}:{}".format(C.MOZRUNNER_PREFS_INI, category))

    return Profile(
        addons=addons,
        preferences=prefs(),
        restore=False,
    )


def xpi_filename(id):
    parts = id.split(".")
    xpi_type = parts[0]
    other_parts = parts[1:]

    if xpi_type == "RP":
        xpi_id = "-" + "-".join(other_parts)
        return "{}/{}{}.xpi".format(C.DIST_DIR, C.EXTENSION_NAME, xpi_id)
    if xpi_type == "helper":
        xpi_id = other_parts[0]
        return "{}/rpc-{}-helper.xpi".format(C.DIST_DIR, xpi_id)
    # other
    return "{}/{}.xpi".format(C.DIST_DIR, xpi_id)
