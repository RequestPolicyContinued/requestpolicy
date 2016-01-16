#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette.runtests import MarionetteHarness, cli as mn_cli

from firefox_ui_harness.arguments import FirefoxUIArguments
from firefox_ui_harness.runtests import FirefoxUIHarness
from rp_ui_harness.runner import RequestPolicyUITestRunner


def cli():
    mn_cli(runner_class=RequestPolicyUITestRunner,
           parser_class=FirefoxUIArguments,
           harness_class=FirefoxUIHarness)

if __name__ == '__main__':
    cli()
