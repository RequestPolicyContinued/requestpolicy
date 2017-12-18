# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from marionette_driver.wait import Wait
from marionette_driver.errors import TimeoutException
import urllib
import time


# delay on <meta> refresh pages
DELAY = 2


def _get_random_string():
    # not a random string, but something unique
    return str(str(time.clock()))


def get_auto_redirection_uri(
    redirection_method,
    append_random_querystring=True,
    origin_pre_path="http://www.maindomain.test/",
    dest_pre_path="http://www.otherdomain.test/",
    dest_path="",
    expected_dest_pre_path=None
):
    additional_parameters = ""
    if redirection_method == "http:location":
        filename = "redirect-http-location-header.php"
    elif redirection_method == "http:refresh":
        filename = "redirect-http-refresh-header.php"
    elif redirection_method == "<meta>":
        filename = "redirect-meta-tag.php"
    elif redirection_method == "<meta> delayed":
        filename = "redirect-meta-tag.php"
        additional_parameters = "&delay=" + str(DELAY)
    elif redirection_method == "<meta> 2":
        filename = "redirect-meta-tag-different-formatting.php"
    elif redirection_method == "<meta> 2 delayed":
        filename = "redirect-meta-tag-different-formatting.php"
        additional_parameters = "&delay=" + str(DELAY)
    elif redirection_method == "js:document.location:<body> onload":
        filename = "redirect-js-document-location-auto.php"
    else:
        raise ValueError("Unknown redirection method: \"{}\""
                         .format(redirection_method))

    origin_uri = (origin_pre_path + filename +
                  "?pre_path=" + urllib.quote(dest_pre_path) +
                  "&path=" + urllib.quote(dest_path) +
                  additional_parameters)
    if append_random_querystring:
        origin_uri += "&random=" + _get_random_string()

    if expected_dest_pre_path is None:
        expected_dest_pre_path = (dest_pre_path if dest_pre_path != ""
                                  else origin_pre_path)
    dest_uri = expected_dest_pre_path + dest_path

    return (origin_uri, dest_uri)


def get_link_redirection_uri(
    redirection_method,
    append_random_querystring=True,
    origin_pre_path="http://www.maindomain.test/",
    # set dest_pre_path to "" to get a relative url
    dest_pre_path="http://www.otherdomain.test/",
    dest_path="",
    expected_dest_pre_path=None
):
    if redirection_method == "js:document.location:<a> href":
        filename = "redirect-js-document-location-link.php"

        linkpage_uri = (
            "{origin_pre_path}{filename}"
            "?pre_path={dest_pre_path}&path={dest_path}"
        ).format(
            origin_pre_path=origin_pre_path,
            filename=filename,
            dest_pre_path=urllib.quote(dest_pre_path),
            dest_path=urllib.quote(dest_path),
        )

        intermediate_uri = None

        if expected_dest_pre_path is None:
            expected_dest_pre_path = (dest_pre_path if dest_pre_path != ""
                                      else origin_pre_path)
        dest_uri = expected_dest_pre_path + dest_path
    else:
        (intermediate_uri, dest_uri) = get_auto_redirection_uri(
            redirection_method,
            append_random_querystring=append_random_querystring,
            origin_pre_path=origin_pre_path,
            dest_pre_path=dest_pre_path,
            dest_path=dest_path,
            expected_dest_pre_path=expected_dest_pre_path)
        linkpage_uri = (origin_pre_path + "link.html?" +
                        urllib.quote(intermediate_uri))
    return (linkpage_uri, intermediate_uri, dest_uri)


def get_info_for_redirection_method(redir_method):
    info = {"redirection_method": redir_method}
    if redir_method in ["<meta> delayed", "<meta> 2 delayed"]:
        info["delay"] = DELAY
    else:
        info["delay"] = 0
    return info


def for_each_auto_redirection_uri(callback, base_info, *args, **kwargs):
    def call(redir_method):
        info = base_info.copy()
        info.update(get_info_for_redirection_method(redir_method))
        uris = get_auto_redirection_uri(redir_method, *args, **kwargs)
        callback(uris, info=info)
    call("http:location")
    call("http:refresh")
    call("<meta>")
    call("<meta> delayed")
    call("<meta> 2")
    call("<meta> 2 delayed")
    call("js:document.location:<body> onload")


def for_each_link_redirection_uri(callback, base_info, *args, **kwargs):
    def call(redir_method):
        info = base_info.copy()
        info.update(get_info_for_redirection_method(redir_method))
        uris = get_link_redirection_uri(redir_method, *args, **kwargs)
        callback(uris, info=info)
    call("http:location")
    call("http:refresh")
    call("<meta>")
    call("<meta> delayed")
    call("<meta> 2")
    call("<meta> 2 delayed")
    call("js:document.location:<body> onload")
    call("js:document.location:<a> href")


def for_each_possible_redirection_scenario(callback, uri_type):
    """Call a function for many (or all) redirection scenarios.

    The callback gets the following data:
      * uris: A tuple of either two or three values, depending on
              the `uri_type`. It's the return value of
              `get_auto_redirection_uri` or `get_link_redirection_uri`.
      * info: A directory containing additional information:
              * is_same_host (boolean)
              * delay (integer; normally zero)
              * redirection_method (string)
    """

    if uri_type == "auto":
        for_each = for_each_auto_redirection_uri
    elif uri_type == "link":
        for_each = for_each_link_redirection_uri
    else:
        raise ValueError("Unknown redirection URI type: \"{}\""
                         .format(uri_type))

    def callback_wrapper(uris, info):
        try:
            callback(uris, info=info)
        except:  # noqa
            print "info: " + str(info)
            print "uris: " + str(uris)
            raise

    # -------------------------------------------------------------------------
    # cross-site redirections
    # -------------------------------------------------------------------------

    # usual cross-site redirection
    for_each(
        callback_wrapper,
        base_info={"is_same_host": False, "is_relative_dest": False},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="http://www.otherdomain.test/",
        dest_path="")

    # destination relative to "http" scheme
    for_each(
        callback_wrapper,
        base_info={"is_same_host": False, "is_relative_dest": True},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="//www.otherdomain.test/",
        dest_path="",
        expected_dest_pre_path="http://www.otherdomain.test/")

    # redirection to PNG image (test against #351)
    for_each(
        callback_wrapper,
        base_info={"is_same_host": False, "is_relative_dest": False},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="http://www.otherdomain.test/",
        dest_path="subdirectory/flag-gray.png")

    # destination URI with "fragment" part
    for_each(
        callback_wrapper,
        base_info={"is_same_host": False, "is_relative_dest": False},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="http://www.otherdomain.test/",
        dest_path="#this-is-a-fragment")

    # -------------------------------------------------------------------------
    # same-site redirections
    # -------------------------------------------------------------------------

    # destination relative to the host
    for_each(
        callback_wrapper,
        base_info={"is_same_host": True, "is_relative_dest": True},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="",
        dest_path="subdirectory/")

    # destination relative to the host, with slash
    for_each(
        callback_wrapper,
        base_info={"is_same_host": True, "is_relative_dest": True},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="/",
        dest_path="subdirectory/",
        expected_dest_pre_path="http://www.maindomain.test/")

    # destination host and protocol specified
    for_each(
        callback_wrapper,
        base_info={"is_same_host": True, "is_relative_dest": False},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="http://www.maindomain.test/",
        dest_path="")

    # destination relative to "http" scheme, but same host
    for_each(
        callback_wrapper,
        base_info={"is_same_host": True, "is_relative_dest": True},
        origin_pre_path="http://www.maindomain.test/",
        dest_pre_path="//www.maindomain.test/",
        dest_path="",
        expected_dest_pre_path="http://www.maindomain.test/")


def assert_redir_is_shown(self, test_url, dest_url, is_shown,
                          additional_info=None):
    self.assertEqual(
        self.redir.is_shown(), is_shown,
        msg=("redirection from {} to {}: the notification should {}show up{}"
             ).format(test_url, dest_url,
                      "NOT " if not is_shown else "",
                      " (" + additional_info + ")" if additional_info else ""))


def assert_url_does_not_load(testcase, url, expected_delay):
    timeout = expected_delay + 0.25
    testcase.assertRaises(TimeoutException, wait_until_url_load, testcase, url,
                          timeout=timeout)


def wait_until_url_load(testcase, url, message="", timeout=(DELAY + 0.25)):
    with testcase.marionette.using_context("content"):
        (
            Wait(testcase.marionette, timeout=timeout)
            .until(lambda m: m.get_url() == url, message=message)
        )
