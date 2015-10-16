# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase


class TestUris(RequestPolicyTestCase):
    """Class for testing specific URI types."""

    def setUp(self):
        super(TestUris, self).setUp()

        self.marionette.set_context("content")

    def tearDown(self):
        try:
            self.requests.stop_listening()
            self.marionette.set_context("chrome")
        finally:
            super(TestUris, self).tearDown()

    def test_uri_without_host(self):
        url = "http://www.maindomain.test/scheme-unknown-and-without-host.html"

        self.requests.start_listening()

        def get_requests_by_dest(dest_uri):
            return [request
                    for request in self.requests.all
                    if request["dest"] == dest_uri]

        with self.marionette.using_context("content"):
            self.marionette.navigate(url)

            link = self.marionette.find_element("tag name", "a")
            link_uri = link.get_attribute("href")

        self.assertEqual(len(get_requests_by_dest(link_uri)), 0,
                         ("There hasn't been any request to '{}' yet."
                          .format(link_uri)))

        link.click()

        self.assertEqual(len(get_requests_by_dest(link_uri)), 1,
                         ("There has been exactly one request to '{}'."
                          .format(link_uri)))
