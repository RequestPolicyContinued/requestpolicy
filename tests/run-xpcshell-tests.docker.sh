#!/bin/bash

set -euo pipefail

make nightly-files
docker run -v `pwd`:`pwd` -w `pwd` -it requestpolicy-xpcshell \
  `dirname $0`/run-xpcshell-tests.sh --no-make \
  $@
