# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from rp_puppeteer.api.rules import Rules
from ..decorators import lazyprop


class ExemplaryRules(BaseLib):
    """Some rules for unit tests."""

    def __init__(self, marionette_getter):
        super(ExemplaryRules, self).__init__(marionette_getter)

        self.rules = Rules(marionette_getter)

    #################################
    # Public Properties and Methods #
    #################################

    #===========================================================================
    # Allow/Temp combinations.
    #===========================================================================

    @lazyprop
    def allow_rule(self):
        return self._rule({"o": {"h": "w"}}, allow=True, temp=False)

    @lazyprop
    def temp_allow_rule(self):
        return self._rule({"o": {"h": "x"}}, allow=True, temp=True)

    @lazyprop
    def deny_rule(self):
        return self._rule({"o": {"h": "y"}}, allow=False, temp=False)

    @lazyprop
    def temp_deny_rule(self):
        return self._rule({"o": {"h": "z"}}, allow=False, temp=True)

    @lazyprop
    def some_rules(self):
        """Some rules that should not collide with each other."""

        return [self.allow_rule, self.temp_allow_rule,
                self.deny_rule, self.temp_deny_rule]

    #===========================================================================
    # Origin/Dest and Scheme/Host/Port combinations.
    #===========================================================================

    @lazyprop
    def rule_without_origin(self):
        return self._rule({"d": {"h": "foo"}}, allow=True)

    @lazyprop
    def rule_without_dest(self):
        return self._rule({"o": {"h": "bar"}}, allow=True)


    @lazyprop
    def pre_path_specs(self):
        """A list of all possible pre-paths, including the expected string."""

        return {
            "s": {"spec": {"s": "s1"},
                  # The string "s1:*" could be confused with "*://s1:*"
                  "expected_string": 'scheme "s1"'},
            "h": {"spec": {"h": "h2"},
                  "expected_string": "h2"},
            "p": {"spec": {"port": 3},
                  "expected_string": "*://*:3"},
            "sh": {"spec": {"s": "s4", "h": "h4"},
                   "expected_string": "s4://h4"},
            "sp": {"spec": {"s": "s5", "port": 5},
                   "expected_string": "s5://*:5"},
            "hp": {"spec": {"h": "h6", "port": 6},
                   "expected_string": "*://h6:6"},
            "shp": {"spec": {"s": "s7", "h": "h7", "port": 7},
                    "expected_string": "s7://h7:7"}
        }


    @lazyprop
    def allow_rule_shp_shp(self):
        return self._rule({"o": {"s": "os", "h": "oh", "port": 1},
                                      "d": {"s": "ds", "h": "dh", "port": 2}},
                                     allow=True, temp=False)

    @lazyprop
    def temp_deny_rule_shp_shp(self):
        return self._rule(
                {"o": {"s": "os", "h": "oh", "port": 3},
                 "d": {"s": "ds", "h": "dh", "port": 4}},
                allow=False, temp=True)


    @lazyprop
    def allow_rule_sh_p(self):
        return self._rule({"o": {"s": "os", "h": "oh"}, "d": {"port": 5}},
                          allow=True, temp=False)

    @lazyprop
    def temp_deny_rule_s_hp(self):
        return self._rule({"o": {"s": "os"},
                           "d": {"h": "dh", "port": 4}},
                          allow=False, temp=True)

    @lazyprop
    def arbitrary_rule_shp_shp(self):
        return self._rule(
            {"o": {"s": "fooscheme", "h": "barhost", "port": 18224},
             "d": {"s": "bazscheme", "h": "xyzhost", "port": 34755}},
            allow=False, temp=True)

    ##################################
    # Private Properties and Methods #
    ##################################

    def _rule(self, *args, **kwargs):
        return self.rules.create_rule(*args, **kwargs)
