#!/bin/bash

cd `dirname $0`
SRC_DIR=../../../src

if [ ! -f "$1" ]; then
  echo "Usage: $0 testfile"
  exit 1
fi

../../run-xpcshell.sh -f helper.js -f $SRC_DIR/modules/Ruleset.jsm $1
