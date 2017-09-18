# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.arguments import FirefoxUIArguments

from rp_utils import constants as C
from rp_utils import utils


class RequestPolicyUIBaseArguments(object):
    name = 'RequestPolicy UI Tests'
    args = [
      # ('--vscode-debug', dict(
      #   action='store_true',
      #   default=False
      # )),
      (['--vscode-debug-secret'], dict()),
      (['--vscode-debug-address'], dict(
        default='0.0.0.0'
      )),
      (['--vscode-debug-port'], dict(
        default='3000'
      )),

      (["--wait-before-first-test"], dict(
        action="store_true"
      )),
      (["--wait-on-failure"], dict(
        action="store_true"
      )),

      (["-m", "--no-make-dependencies"], dict(
        dest="make_deps", action="store_false", default=True
      )),
      (["-q", "--quick"], dict(
        action="store_true", default=False
      )),
      (["-nq", "--non-quick"], dict(
        action="store_true", default=False
      )),
      (["--logfile-stem"], dict()),
      (["--rp-addon"], dict(
          action="store", default="RP.legacy.ui-testing"
      )),
    ]

    def parse_args_handler(self, args):
        test_type = "user-specific"

        if len(args.tests) == 0:
            m_root = "tests/marionette/"
            if not args.non_quick:
                args.tests += [m_root + "tests-quick.manifest.ini"]
            if not args.quick:
                args.tests += [m_root + "tests-non-quick.manifest.ini"]
            if args.quick:
                if not args.non_quick:
                    test_type = "quick"
            elif args.non_quick:
                test_type = "non-quick"
            else:
                test_type = "all"
        args.tests = ([("tests/marionette/tests-special/"
                        "test_before_all_other_tests.py")] +
                      args.tests)

        if args.binary is None:
            args.binary = ".mozilla/software/firefox/default/firefox"
        if args.addon is None:
            args.addon = []
        args.addon += [
            utils.xpi_filename(xpi)
            for xpi in [args.rp_addon, "helper.dev", "helper.ui-testing"]
        ]
        if args.address is None:
            import os
            # localhost:28xxx
            display = os.environ["DISPLAY"].replace(":", "")
            args.address = "localhost:28{:0>3}".format(display)

        if args.logfile_stem is None:
            from datetime import datetime
            args.logfile_stem = "{}.{}".format(
                datetime.today().strftime("%y%m%d-%H%M%S"), test_type)

        def log_filename(ext):
            return "{}/{}{}".format(C.LOGS_DIR, args.logfile_stem, ext)

        if args.gecko_log is None:
            args.gecko_log = log_filename(".gecko.log")
        if args.log_html is None:
            args.log_html = []
        args.log_html.append(log_filename(".html"))
        if args.log_tbpl is None:
            args.log_tbpl = []
        args.log_tbpl.append(log_filename(".tbpl.log"))


class RequestPolicyUIArguments(FirefoxUIArguments):

    def __init__(self, **kwargs):
        FirefoxUIArguments.__init__(self, **kwargs)

        self.register_argument_container(RequestPolicyUIBaseArguments())
