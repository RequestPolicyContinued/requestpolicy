#!/bin/bash

source $(dirname "$0")/check-common

main_file="$1"
ref_file="$2"

# ==============================================================================
# Checks with a single file

check_file_exists "${main_file}"
check_line_endings "${main_file}"
check_whitespace "${main_file}"

check_placeholders () {
  local lines=$(grep '%S' "${main_file}" | grep -E '%[0-9]+\$S')
  if [[ "${lines}" != "" ]]; then
    local msg
    msg="File '${main_file}' contains lines with both '%S' and '%n\$S':"
    msg="${msg}\n${lines}"
    fail "${msg}"
  fi
}
check_placeholders

if [[ "${ref_file}" = "" ]] || [[ "${ref_file}" = "${main_file}" ]]; then
  exit
fi

# ==============================================================================
# Comparison checks with the reference file

get_lines () { grep -Ev -e '^#' -e '^$' "$1"; }
main__lines=$(get_lines "${main_file}")
ref__lines=$(get_lines "${ref_file}")

get_keys () { echo "$1" | grep -Eo '^[^=]+'; }
main__keys=$(get_keys "${main__lines}")
ref__keys=$(get_keys "${ref__lines}")

check_all_keys_exist () {
  local main__sorted=$(echo "${main__keys}" | sort)
  local ref__sorted=$(echo "${ref__keys}" | sort)
  _check_diff \
    "${main__sorted}" \
    "${ref__sorted}" \
    "The list of keys in file '${main_file}' differs from the reference."
}
check_all_keys_exist

check_key_order () {
  _check_diff \
    "${main__keys}" \
    "${ref__keys}" \
    "The order of the keys in file '${main_file}' does not match the reference."
}
check_key_order

check_placeholders () {
  convert () {
    echo "$1" | \
      grep -Eon -e '^[^=]+' -e '%S' -e '%[0-9]+\$S' | \
      sort -n | uniq
  }
  local main__converted=$(convert "${main__lines}")
  local ref__converted=$(convert "${ref__lines}")
  _check_diff \
    "${main__converted}" \
    "${ref__converted}" \
    "Not all placeholders are used in both locales -- file '${main_file}'."
}
check_placeholders
