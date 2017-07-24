#!/usr/bin/env bash

set -euo pipefail

GIT=/usr/bin/git

$GIT rev-list HEAD | wc --lines
