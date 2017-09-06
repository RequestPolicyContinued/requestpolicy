# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils
from marionette_driver.marionette import HTMLElement


class ElementBaseLib(BaseLib):
    """A base class for all HTMLElement wrapper classes."""

    def __init__(self, marionette_getter, element):
        assert isinstance(element, HTMLElement)

        BaseLib.__init__(self, marionette_getter)
        self._element = element

        self.app_info = AppInfo(marionette_getter)
        self.utils = Utils(marionette_getter)

    @property
    def element(self):
        """Returns the reference to the underlying DOM element.

        :returns: Reference to the DOM element.
        """

        return self._element


class HTMLFormBaseLib(ElementBaseLib):
    """A base class for all HTML form wrapper classes."""

    @staticmethod
    def input_field(find_method, find_target):
        """Return a property attribute for an <input> form field.

        The function takes care of finding the <input> HTML element and
        getting/setting its `value` attribute. The parameters `find_method`
        and `find_target` are passed to `Marionette.find_element()`.

        :param find_method: The method to use to locate the <input> element.
        :param find_target: The target of the search.
        :returns: Property attribute.
        """

        return property(
            lambda self: self._get_input_field_value(find_method, find_target),
            lambda self, value: (
                self._set_input_field_value(
                    find_method, find_target, value)
            )
        )

    def _get_input_field_value(self, find_method, find_target):
        input_field = self._get_input_field(find_method, find_target)
        if self.utils.compare_version(self.app_info.version, "49") < 0:
            # up to Firefox 48 (Bug 1272653)
            return input_field.get_attribute("value")
        return input_field.get_property("value")

    def _set_input_field_value(self, find_method, find_target, value):
        self.marionette.execute_script("""
          arguments[0].value = arguments[1];
        """, script_args=[self._get_input_field(find_method, find_target),
                          value])

    def _get_input_field(self, find_method, find_target):
        return self.element.find_element(find_method, find_target)
