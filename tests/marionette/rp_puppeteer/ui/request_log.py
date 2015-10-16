# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from firefox_puppeteer.base import BaseLib
from contextlib import contextmanager


class RequestLog(BaseLib):

    #################################
    # Public Properties and Methods #
    #################################

    @property
    def row_count(self):
        return self.marionette.execute_script("""
          var tree = arguments[0];
          return tree.view.rowCount;
        """, [self._tree])

    @property
    def rows(self):
        """Get a list of all rows."""

        return self.marionette.execute_script("""
          var tree = arguments[0];

          {
            let getCol = tree.columns.getNamedColumn.bind(tree.columns);

            var originCol = getCol("rpcontinued-requestLog-origin");
            var destCol = getCol("rpcontinued-requestLog-destination");
            var blockedCol = getCol("rpcontinued-requestLog-blocked");
            var timeCol = getCol("rpcontinued-requestLog-time");
          }

          var getCellText = tree.view.getCellText.bind(tree.view);
          var isRequestAllowed = function (row) {
            var blockedImg = "chrome://rpcontinued/skin/dot.png";
            var imgSrc = tree.view.getImageSrc(row, blockedCol);
            return imgSrc !== blockedImg;
          };

          var rows = [];

          for (let i = 0; i < tree.view.rowCount; ++i) {
            rows.push({
              origin: getCellText(i, originCol),
              dest: getCellText(i, destCol),
              isAllowed: isRequestAllowed(i),
              time: getCellText(i, timeCol)
            });
          }

          return rows;
        """, [self._tree])

    def open(self):
        if not self.is_open():
            self._toggle()

            # Briefly enter the iframe to make sure the it's loaded.
            with self.in_iframe():
                pass

    def is_open(self):
        request_log_uri = "chrome://rpcontinued/content/ui/request-log.xul"
        return self._iframe.get_attribute("src") == request_log_uri

    def close(self):
        self._close_button.click()

    def clear(self):
        self._clear_button.click()

    def switch_to_iframe(self):
        self.marionette.switch_to_frame(self._iframe)

    @contextmanager
    def in_iframe(self):
        frame = self.marionette.get_active_frame()
        self.switch_to_iframe()
        yield
        self.marionette.switch_to_frame(frame)

    ##################################
    # Private Properties and Methods #
    ##################################

    @property
    def _close_button(self):
        return self.marionette.find_element("id",
                                            "rpcontinued-requestLog-close")

    @property
    def _clear_button(self):
        return self.marionette.find_element("id",
                                            "rpcontinued-requestLog-clear")

    @property
    def _iframe(self):
        """Return the <iframe> of the Request Log."""

        return (
            self.marionette
            .find_element("id", "rpcontinued-requestLog-frame")
        )

    @property
    def _tree(self):
        return self.marionette.find_element("id",
                                            "rpcontinued-requestLog-tree")

    def _toggle(self):
        self.marionette.execute_script("""
          window.rpcontinued.overlay.toggleRequestLog();
        """)
