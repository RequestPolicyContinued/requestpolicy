#!./dev_env/python/bin/python2.7

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette.runtests import cli as mn_cli, MarionetteHarness
from rp_ui_harness.arguments import RequestPolicyUIArguments
from rp_ui_harness.runner import RequestPolicyUITestRunner
from rp_utils import constants as C, utils

import subprocess


class RequestPolicyUIHarness(MarionetteHarness):
    _profile_rpc = None

    def parse_args(self, *fn_args, **fn_kwargs):
        parsed_args = super(RequestPolicyUIHarness, self).parse_args(
            *fn_args, **fn_kwargs)

        if parsed_args["make_deps"]:
            subprocess.check_call(["make", "_marionette_dependencies"])

        self._profile_rpc = utils.create_profile(
            profile=parsed_args["profile"],
            addons=parsed_args["addon"],
            pref_categories=["common", "ui_tests"]
        )
        parsed_args["profile"] = self._profile_rpc.profile

        return parsed_args

    def run(self):
        try:
            failed = super(RequestPolicyUIHarness, self).run()
        finally:
            self._profile_rpc.cleanup()
        if not failed:
            self._check_gecko_log()
        return failed

    def _check_gecko_log(self):
        from rp_utils.utils import get_gecko_log_error_lines
        error_lines = get_gecko_log_error_lines(self.args.get("gecko_log"))
        if len(error_lines) == 0:
            return
        print "Error have been detected after running '{}' tests:"
        for line in error_lines:
            print line


def cli(args=None):
    mn_cli(runner_class=RequestPolicyUITestRunner,
           parser_class=RequestPolicyUIArguments,
           harness_class=RequestPolicyUIHarness,
           args=args
           )

if __name__ == '__main__':
    cli()
