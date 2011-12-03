#!/bin/bash

cd `dirname $0`
MOZ_BIN_DIR=/moz/z.dev1/obj/dist/bin
SRC_DIR=../../../src

if [ ! -f "$1" ]; then
  echo "Usage: $0 testfile"
  exit 1
fi

$MOZ_BIN_DIR/js -f helper.js -f $SRC_DIR/modules/Policy.jsm $1

