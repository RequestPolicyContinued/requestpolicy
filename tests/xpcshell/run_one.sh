#!/bin/bash

TEST_DIR=`dirname $0`

MOZ_SRC_DIR=/moz/z.dev1/mc
MOZ_BIN_DIR=/moz/z.dev1/obj/dist/bin

PROFILE_NAME="requestpolicy-xpcshell"

if [ -z "$1" ]; then
  echo "Usage: $0 test_filename.js"
  exit 1
fi

python -u $MOZ_SRC_DIR/config/pythonpath.py \
   -I$MOZ_SRC_DIR/build  \
   $MOZ_SRC_DIR/testing/xpcshell/runxpcshelltests.py  \
   $MOZ_BIN_DIR/xpcshell \
   --profile-name=$PROFILE_NAME \
   --no-logfiles \
   --test-path=$1 \
   $TEST_DIR

