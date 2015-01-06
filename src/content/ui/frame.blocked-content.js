/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

let ManagerForBlockedContent = (function() {
  let self = {};


  let missingImageDataUri = "data:image/png;base64,"
      + "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c"
      + "6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0"
      + "SU1FB9gMFRANL5LXnioAAAJWSURBVDjLnZI/ixtXFMV/972ZNzPSrmTtalex"
      + "lsWBGMfEYOzaVciXyKdIkW/hFKnS22WafIDUxk0g2AQSgm0csIPWK42ktaSR"
      + "NPP+pRBK5SLOqS7cew7ccw4xxrPJ+8XdHx4+7AE8e3Cj++zLm71fvrqT8x+Q"
      + "AK35dJr2n/x89urTa+eDm/cS+eI2y3eT+Lx/bt8u1vNqfDH++teXdk/6ThAf"
      + "UUBIgL9ku75z/8WL7LOlhXIGJ0Pyw75wMcnGv//xSQ2DH4ddu9k01dXWsWzc"
      + "ofhYaiiViLjiWi9UWQa1gzcjWF7hgfzzW5ydnXB62JLjg0PTLfJertNepnQS"
      + "IA+gE4Cs03UuNYYQYP4e5jPogmSG9vA6rrjC+0AxN2i5Qk0DpXVJhCQB0EVR"
      + "rzqdFgB1DZfvCDHixiV2NqO6LHHKIKnQMoaWbFBgIrQVgIXaDc+JCHgP5QRZ"
      + "r4jzGWFbo6yncRYviiiQKUhBRch3Lyix4bgPWsAkcDkmZAV2OiE0DaI1WoES"
      + "hRKF3sWnmt01pFBnJydEpZDEwHSGt47lYsls43AIXjTWV9R1Qx0DGahqLyAh"
      + "bqrj0/ib0nRzXNoyCo0Kkor2llV0eKOwdUMg4pSQA7JPQXvnJv1B+GlwOvrG"
      + "laXB6fV2lb5t6qOtike56DSJgYDGBQcOAsQAfueBMeHR48fhadb1j/58HWAR"
      + "dt6yBv7+/vpBe2o5OogxlcaKdt5aKCNsk309W0WxKQjmQ33/9mJVAdWHdmo/"
      + "tNvtRZIkfCz+ZQwGg6rT6Zj/LTAajTbD4bD5WIF/AAseEisPFO8uAAAAAElF"
      + "TkSuQmCC";

  let transparentImageDataUri = "data:image/gif;base64,R0lGODlhAQABAIAAA"
      + "AAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  function indicateBlockedVisibleObjects(message) {
    let {blockedURIs, docID} = message.data;
    let document = DocManager.getDocument(docID);
    if (!document) {
      return;
    }
    let images = document.getElementsByTagName("img");

    // Ideally, want the image to be a broken image so that the alt text
    // shows. By default, the blocked image will just not show up at all.
    // Setting img.src to a broken resource:// causes "save page as" to fail
    // for some earlier Fx 3.x versions. Also, using a broken resource://
    // causes our width setting to be ignored, as does using null for img.src.
    // With Firefox 4, setting img.src to null doesn't work reliably for
    // having the rest of the styles (e.g. background and border) applied.
    // So, for now we're punting on trying to display alt text. We'll just use
    // a transparent image as the replacement image.
    // Note that with our changes to the image here, "save page as" works but
    // different data is saved depending on what type of "save page as" the
    // user performs. With "save all files", the saved source includes the
    // original, blocked image src. With "web page, complete" the saved source
    // has changes we make here to show the blocked request indicator.

    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      // Note: we're no longer checking img.requestpolicyBlocked here.
      if (!img.requestpolicyIdentified && img.src in blockedURIs) {
        img.requestpolicyIdentified = true;
        img.style.border = "solid 1px #fcc";
        img.style.backgroundRepeat = "no-repeat";
        img.style.backgroundPosition = "center center";
        img.style.backgroundImage = "url('" + missingImageDataUri + "')";
        if (!img.width) {
          img.width = 50;
        }
        if (!img.height) {
          img.height = 50;
        }
        img.title = "[" + blockedURIs[img.src].identifier + "]"
            + (img.title ? " " + img.title : "")
            + (img.alt ? " " + img.alt : "");
        img.src = transparentImageDataUri;
      }
    }
  }

  addMessageListener(C.MMID + ":indicateBlockedVisibleObjects",
                     indicateBlockedVisibleObjects);

  return self;
}());
