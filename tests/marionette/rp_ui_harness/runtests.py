#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if __name__ == '__main__' and __package__ is None:
    from os import sys, path
    sys.path.append(path.join(
        path.dirname(path.dirname(path.abspath(__file__)))
    ))


from marionette.runtests import cli as mn_cli

from rp_ui_harness.arguments import RequestPolicyUIArguments
from rp_ui_harness.runner import RequestPolicyUITestRunner


def cli(args=None):
    mn_cli(runner_class=RequestPolicyUITestRunner,
           parser_class=RequestPolicyUIArguments,
           args=args
           )

if __name__ == '__main__':
    cli()
