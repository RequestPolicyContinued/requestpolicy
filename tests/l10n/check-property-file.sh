#!/bin/bash

main_file="$1"
ref_file="$2"

fail () {
  echo -e "Check failed: $1"
  exit 1
}

check_file_exists () {
  local filename="$1"
  test -f "${filename}" || \
    fail "File '${filename}' does not exist\!"
}

# ==============================================================================
# Checks with a single file

check_file_exists "${main_file}"

check_line_endings () {
  local n_lines=$(grep -E $'\r'\$ "${main_file}" | wc -l)
  test "${n_lines}" = "0" || \
    fail "File '${main_file}' does not have Unix line endings."
}
check_line_endings

check_whitespace () {
  local n_lines=$(grep -E '[[:space:]]$' "${main_file}" | wc -l)
  test "${n_lines}" = "0" || \
    fail "File '${main_file}' contains lines with EOL-whitespace."
}
check_whitespace

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

_check_diff () {
  local diff=$(diff <(echo "${1}") <(echo "${2}"))
  if [[ "${diff}" != "" ]]; then
    fail "${3}\nDiff:\n${diff}"
  fi
}

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
  # FIXME: The "convert" function is very slow!
  convert () {
    echo "$1" | \
    while IFS= read -r line; do
      local key=$(echo "${line}" | grep -Eo '^[^=]+')
      local placeholders=$(echo "${line}" | \
        grep -Eo -e '%S' -e '%[0-9]+\$S' | \
        sort -u | \
        tr '\n' ' ' \
      )
      echo "${key}=${placeholders}"
    done
  }
  local main__converted=$(convert "${main__lines}")
  local ref__converted=$(convert "${ref__lines}")
  _check_diff \
    "${main__converted}" \
    "${ref__converted}" \
    "Not all placeholders are used in both locales -- file '${main_file}'."
}
check_placeholders
