#!/bin/bash

set -euo pipefail

TEST_DIR=`dirname $0`/xpcshell

MOZ_SRC_DIR=/moz/source
MOZ_OBJ_DIR=($MOZ_SRC_DIR/obj-*)
MOZ_BIN_DIR=$MOZ_OBJ_DIR/dist/bin

NO_MAKE=

POSITIONAL=()
while [[ $# -gt 0 ]]
do
  key="$1"

  case $key in
    --no-make)
    NO_MAKE=YES
    shift
    ;;

    *)
    POSITIONAL+=("$1")
    shift
    ;;
  esac
done
set -- "${POSITIONAL[@]}" # restore positional parameters

if [ "$NO_MAKE" != "YES" ]; then
  (cd `dirname $0`/.. ; make nightly-files)
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
  --xre-path $MOZ_BIN_DIR \
  --app-path $MOZ_BIN_DIR/browser \
  --testing-modules-dir $MOZ_OBJ_DIR/_tests/modules \
  --build-info-json $MOZ_OBJ_DIR/mozinfo.json \
  --no-logfiles \
  --manifest $TEST_DIR/xpcshell.ini \
  --xpcshell $MOZ_BIN_DIR/xpcshell \
  $@
