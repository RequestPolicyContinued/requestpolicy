#!/bin/bash

set -euo pipefail

docker build tests/xpcshell/docker -t requestpolicy-xpcshell
