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

    diffs = [
        (
            """<a href="{base_uri}/compare/{prev}...{current}">"""
            """{prev}...{current}"""
            """</a>"""
        ),
    ]
    if prev != prev_version:
        diffs.append(
            """<a href="{base_uri}/compare/{prev_version}...{current}">"""
            """{prev_version}...{current}"""
            """</a>"""
        )
    if len(diffs) == 1:
        print_str__diff = """Source code Diff: {}""".format(diffs[0])
    else:
        print_str__diff = (
            """Source code Diffs: <ul>\n{}\n</ul>"""
        ).format("\n".join(
            ["<li>" + diff + "</li>" for diff in diffs]
        ))

    print_kwargs = dict(
        base_uri=base_uri,
        changelog_hash=changelog_hash,
        current=current,
        prev=prev,
        prev_version=prev_version,

    )

    uri_to_changes = (
        """{base_uri}/blob/{current}/ChangeLog.md#{changelog_hash}"""
    ).format(**print_kwargs)
    link_to_changes = (
        """<a href="{uri_to_changes}">Changes since {prev_version}</a>"""
    ).format(uri_to_changes=uri_to_changes, **print_kwargs)

    link_to_code = (
        """<a href="{base_uri}/tree/{current}">{current}</a>"""
    ).format(**print_kwargs)

    print (
        textwrap.dedent("""\
            {link_to_changes}

            Source code of this release: {link_to_code}
            {diff}""")
    ).format(
        link_to_changes=link_to_changes,
        link_to_code=link_to_code,
        diff=print_str__diff
    )


if __name__ == "__main__":
    main()
