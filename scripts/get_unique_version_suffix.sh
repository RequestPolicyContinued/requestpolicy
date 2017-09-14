#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'


rev_count=`./scripts/get_git_rev_count.sh`
commit_sha=`./scripts/get_git_head_sha.sh`
echo ".${rev_count}.r${commit_sha}.pre"
