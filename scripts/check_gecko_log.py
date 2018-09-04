#!./dev_env/python/bin/python2.7
# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import argparse
from rp_utils.utils import get_gecko_log_error_lines


def parse_args():
    parser = argparse.ArgumentParser(
        description='Check a Gecko logfile for errors.')
    parser.add_argument("-p", "--print", dest="do_print", action="store_true",
                        help='print error lines')
    parser.add_argument('file', help='path to the gecko log')
    return parser.parse_args()


def main():
    args = parse_args()
    lines = get_gecko_log_error_lines(args.file)
    if len(lines) > 0:
        if args.do_print:
            for line in lines:
                print line
        exit(code=1)


if __name__ == "__main__":
    main()
