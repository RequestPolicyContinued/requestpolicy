# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_ui_harness.arguments import FirefoxUIArguments


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
      ))
    ]

    def parse_args_handler(self, args):
        args.tests = ([("tests/marionette/tests-special/"
                        "test_before_all_other_tests.py")] +
                      args.tests)


class RequestPolicyUIArguments(FirefoxUIArguments):

    def __init__(self, **kwargs):
        FirefoxUIArguments.__init__(self, **kwargs)

        self.register_argument_container(RequestPolicyUIBaseArguments())
