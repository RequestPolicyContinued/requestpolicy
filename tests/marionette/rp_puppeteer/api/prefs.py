# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from contextlib import contextmanager

@contextmanager
def using_pref(prefs, pref_name, pref_value):
    """Context manager for setting a pref temporarily.

    :param prefs: The Preferences() object.
    :param pref_name: The preference to set.
    :param pref_value: The value to set the preference to.
    """

    prefs.set_pref(pref_name, pref_value)
    try:
        yield
    finally:
        prefs.reset_pref(pref_name)
