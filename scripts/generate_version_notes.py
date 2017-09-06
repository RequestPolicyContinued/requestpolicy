#!./dev_env/python/bin/python2.7

import argparse
import textwrap
from subprocess import check_output

base_uri="https://github.com/RequestPolicyContinued/requestpolicy"

def parse_args():
    parser = argparse.ArgumentParser(description='Generate version notes.')
    parser.add_argument("type", action="store", choices=["nightly", "stable"])
    parser.add_argument("-p", "--prev", action="store")
    parser.add_argument("-c", "--current", action="store")
    parser.add_argument("-pv", "--prev-version", action="store")
    return parser.parse_args()

def main():
    args = parse_args()
    if args.type == "stable":
        assert args.prev is not None
        assert args.current is not None

        current = "v{}".format(args.current)
        prev = "v{}".format(args.prev)
        prev_version = prev

        changelog_hash = "version-{}".format(args.current.replace(".", ""))
    else: # nightly
        assert args.prev is not None
        assert args.prev_version is not None

        current = check_output(["./scripts/get_git_head_sha.sh"]).strip()
        prev = args.prev
        prev_version = "v{}".format(args.prev_version)

        changelog_hash = "next-version"

    diffs = ["""<a href="{base_uri}/compare/{prev}...{current}">{prev}...{current}</a>"""]
    if prev != prev_version:
        diffs.append("""<a href="{base_uri}/compare/{prev_version}...{current}">{prev_version}...{current}</a>""")
    if len(diffs) == 1:
        diff_str = """Source code Diff: {}""".format(diffs[0])
    else:
        diff_str = """Source code Diffs: <ul>\n{}\n</ul>""".format("\n".join(
            ["<li>" + diff + "</li>" for diff in diffs]
        ))

    print (
        textwrap.dedent("""\
            <a href="{base_uri}/blob/{current}/ChangeLog.md#{changelog_hash}">Changes since {prev_version}</a>

            Source code of this release: <a href="{base_uri}/tree/{current}">{current}</a>"""
        ) + "\n" +
        diff_str
    ).format(
        base_uri=base_uri,
        changelog_hash=changelog_hash,
        current=current,
        prev=prev,
        prev_version=prev_version,
    )


if __name__ == "__main__":
    main()
