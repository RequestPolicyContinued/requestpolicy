#!/usr/bin/env bash

set -euo pipefail

stampfile="$1"
expected_content="$2"

if [ -f "$stampfile" ]; then
  stampfile_contents="$(cat $stampfile)"
fi

if [ ! -f "$stampfile" ] || [ "$stampfile_contents" != "$expected_content" ]; then
  echo -n "$expected_content" > "$stampfile"
fi
