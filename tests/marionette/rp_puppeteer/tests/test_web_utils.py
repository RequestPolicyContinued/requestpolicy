# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_ui_harness.testcases import RequestPolicyTestCase


class TestWebUtils(RequestPolicyTestCase):

    def test_select_element_text(self):
        with self.marionette.using_context("content"):
            # Load the test url.
            test_url = "http://www.maindomain.test/link_1.html"
            self.marionette.navigate(test_url)

            # Find the element and get its text content.
            element = self.marionette.find_element("id", "text_url_1")
            element_text = element.get_attribute("textContent")

            # FUNCTION UNDER TEST:
            # Select the element's text.
            self.web_utils.select_element_text(element)

        # Copy the selection to the clipboard.
        self.ctx_menu.select_entry("context-copy", element)

        # Get the clipboard content.
        text_in_clipboard = self.marionette.execute_script("""
          // Code taken from
          // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Using_the_clipboard

          var Cc = Components.classes, Ci = Components.interfaces;
          Components.utils.import("resource://gre/modules/Services.jsm");

          var transferable = Cc["@mozilla.org/widget/transferable;1"]
              .createInstance(Ci.nsITransferable);
          transferable.init(null);
          transferable.addDataFlavor("text/unicode");

          Services.clipboard.getData(transferable,
                                     Services.clipboard.kGlobalClipboard);

          var str = {}, strLength = {};
          transferable.getTransferData("text/unicode", str, strLength);
          var pastetext = str.value.QueryInterface(Ci.nsISupportsString).data;
          return pastetext;
        """)

        # Somehow the `select_element_text()` function selects the text
        # contents plus one leading and one trailing space. The same behavior
        # occurs when triple-clicking on the node. The triple-clicking behavior
        # can be changed when the `browser.triple_click_selects_paragraph`
        # pref is set to `false`, but, however, this doesn't change the behavior
        # for `select_element_text()`. Still, as long as this is not a problem
        # for the use cases of `select_element_text()`, there's no need to
        # fix it.
        expected_text = " {} ".format(element_text)

        self.assertEqual(text_in_clipboard, expected_text)
