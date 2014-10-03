#!/bin/bash

MOZ_SRC_DIR=/moz/mozilla-central
MOZ_OBJ_DIR=$MOZ_SRC_DIR/obj-*
MOZ_BIN_DIR=$MOZ_OBJ_DIR/dist/bin

$MOZ_BIN_DIR/run-mozilla.sh $MOZ_BIN_DIR/xpcshell
