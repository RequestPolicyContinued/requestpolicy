#!/usr/bin/env bash

set -euo pipefail

GIT=/usr/bin/git

$GIT rev-parse --short HEAD
