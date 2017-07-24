#!/bin/bash

source $(dirname "$0")/check-common

main_file="$1"
ref_file="$2"

# ==============================================================================
# Checks with a single file

check_file_exists "${main_file}"
check_line_endings "${main_file}"
check_whitespace "${main_file}"

if [[ "${ref_file}" = "" ]] || [[ "${ref_file}" = "${main_file}" ]]; then
  exit
fi

# ==============================================================================
# Comparison checks with the reference file

# diff w/o contents
check_diff_wo_contents () {
  convert () {
    sed --regexp-extended \
      's/^(<!ENTITY [a-zA-Z.]+ ")[^"]+(">)$/\1\2/' \
      "$1"
  }
  local main__converted=$(convert "${main_file}")
  local ref__converted=$(convert "${ref_file}")
  _check_diff \
    "${main__converted}" \
    "${ref__converted}" \
    "The file '${main_file}' (ignoring the translated values) does not match the reference."
}
check_diff_wo_contents
