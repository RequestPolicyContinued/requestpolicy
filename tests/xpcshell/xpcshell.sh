#!/bin/bash

TEST_DIR=`dirname $0`

MOZ_SRC_DIR=/moz/z.dev1/mc
MOZ_BIN_DIR=/moz/z.dev1/obj/dist/bin

python -u $MOZ_SRC_DIR/config/pythonpath.py \
   -I$MOZ_SRC_DIR/build  \
   $MOZ_SRC_DIR/testing/xpcshell/runxpcshelltests.py  \
   $MOZ_BIN_DIR/xpcshell \
   $1

