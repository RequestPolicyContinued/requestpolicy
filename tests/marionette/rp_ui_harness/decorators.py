# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


def lazyprop(target):
    attr_name = '_lazy_' + target.__name__
    @property
    def wrapper(self, *args, **kwargs):
        if not hasattr(self, attr_name):
            setattr(self, attr_name, target(self, *args, **kwargs))
        return getattr(self, attr_name)
    return wrapper
