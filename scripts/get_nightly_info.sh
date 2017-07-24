#!/usr/bin/env bash

set -euo pipefail

base_uri="https://github.com/RequestPolicyContinued/requestpolicy"

current_sha=`./scripts/get_git_head_sha.sh`
prev_sha="$1"

echo "Revision based on: <a href=\"${base_uri}/commit/${current_sha}\">${current_sha}</a>"
echo "Diff: <a href=\"${base_uri}/compare/${prev_sha}...${current_sha}\">${prev_sha}...${current_sha}</a>"
