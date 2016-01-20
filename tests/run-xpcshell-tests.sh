#!/bin/bash

TEST_DIR=`dirname $0`/xpcshell

MOZ_SRC_DIR=/moz/mozilla-central
MOZ_OBJ_DIR=($MOZ_SRC_DIR/obj-*)
MOZ_BIN_DIR=$MOZ_OBJ_DIR/dist/bin

if [ "$1" = "--help" ]; then
  echo 'Hints:'
  echo '  * Append a test filename to run a single test. Example:'
  echo "      $0 test_file.js"
  echo
else
  (cd `dirname $0`/.. ; make unit-testing-files)
fi

export PYTHONPATH=\
$MOZ_SRC_DIR/build:\
$MOZ_OBJ_DIR/build:\
$MOZ_SRC_DIR/testing/mozbase/mozdebug:\
$MOZ_SRC_DIR/testing/mozbase/mozinfo:\
$MOZ_SRC_DIR/testing/mozbase/mozcrash:\
$MOZ_SRC_DIR/testing/mozbase/mozfile:\
$MOZ_SRC_DIR/testing/mozbase/mozlog:\
$MOZ_SRC_DIR/testing/mozbase/mozscreenshot

python2.7 $MOZ_SRC_DIR/testing/xpcshell/runxpcshelltests.py \
  --build-info-json $MOZ_OBJ_DIR/mozinfo.json \
  --no-logfiles \
  --manifest $TEST_DIR/xpcshell.ini \
  --xpcshell $MOZ_BIN_DIR/xpcshell \
  $@
