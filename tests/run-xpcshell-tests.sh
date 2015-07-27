#!/bin/bash

TEST_DIR=`dirname $0`/xpcshell

MOZ_SRC_DIR=/moz/mozilla-central
MOZ_OBJ_DIR=($MOZ_SRC_DIR/obj-*)
MOZ_BIN_DIR=$MOZ_OBJ_DIR/dist/bin

ARGUMENTS=""

if [ -z "$1" ]; then
  ARGUMENTS=""
elif [ "$1" = "--help" ]; then
  echo "Usage:"
  echo "  $0 [test_filename.js]     (run all tests or just one.)"
  exit
else
  ARGUMENTS=" --test-path=$1 "
fi

export PYTHONPATH=\
$MOZ_SRC_DIR/build:\
$MOZ_OBJ_DIR/build:\
$MOZ_SRC_DIR/testing/mozbase/mozdebug:\
$MOZ_SRC_DIR/testing/mozbase/mozinfo:\
$MOZ_SRC_DIR/testing/mozbase/mozcrash:\
$MOZ_SRC_DIR/testing/mozbase/mozfile:\
$MOZ_SRC_DIR/testing/mozbase/mozlog

python2.7 $MOZ_SRC_DIR/testing/xpcshell/runxpcshelltests.py \
  --build-info-json $MOZ_OBJ_DIR/mozinfo.json \
  --no-logfiles \
  $ARGUMENTS \
  $MOZ_BIN_DIR/xpcshell \
  $TEST_DIR
