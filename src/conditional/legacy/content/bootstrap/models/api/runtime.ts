/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
 * Copyright (c) 2017 Jérard Devarulrajah
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

import {MaybePromise} from "content/lib/classes/maybe-promise";
import {Module} from "content/lib/classes/module";
import {createListenersMap} from "content/lib/utils/listener-factories";

declare const Services: any;

export class Runtime extends Module {
  protected moduleName = "runtime";

  private events = createListenersMap(["onMessage"]);

  get backgroundApi() {
    return {
      getBrowserInfo: this.getBrowserInfo.bind(this),
      getURL: this.getURL.bind(this),
      onMessage: this.events.interfaces.onMessage,
    };
  }

  get contentApi() {
    return {
      connect: null,
      getManifest: null,
      getURL: null,
      onConnect: null,
      onMessage: null,
      sendMessage: this.sendMessageFromContent.bind(this),
    };
  }

  private getBrowserInfo() {
    const {name, vendor, version, appBuildID: buildID} = Services.appinfo;
    return Promise.resolve({name, vendor, version, buildID});
  }

  /**
   * Map a relative path to manifest.json to a legacy path (XUL/XPCOM).
   * All paths pointing to a html file in /content/settings/ are mapped into
   * about:requestpolicy?, other paths are mapped into chrome://rpcontinued/ :
   *  - /content/settings/filename.html will become about:requestpolicy?filename
   *  - /foo/bar.file.css will become chrome://rpcontinued/foo/bar.file.css
   * Leading / or ./ are ignored and the path is case sensitive.
   *
   * @param {string} path
   * @return {string}
   */
  private getURL(path: string) {
    // Pattern to match mapping into about:requestpolicy?file
    // 1) ^(?:\.\/|\/)? : matches even if path starts with "content/"
    // or "./content"
    // 2) content\/settings\/ : checks path (case sensitive)
    // 3) ([^\/]+) : capturing group for the filename
    // 4) \.[hH][tT][mM][lL]$ : matches html extension (case insensitive)
    // Disable max-length line lint on this one because using new RegExp
    // to split it isn't recommended if the pattern doesn't change
    // eslint-disable-next-line max-len
    const patternAbout =
        /^(?:\.\/|\/)?content\/settings\/([^/]+)\.[hH][tT][mM][lL]$/mg;

    // Pattern to match prepending with chrome://rpcontinued/
    // 1) ^(?:\.\/|\/)? : non capturing group for leading "/" or "./"
    const patternChrome = /^(?:\.\/|\/)?(.+)$/mg;

    let legacyPath = null;

    if (patternAbout.test(path)) {
      legacyPath = path.replace(patternAbout, "about:requestpolicy?$1");
    } else {
      legacyPath = path.replace(patternChrome, "chrome://rpcontinued/$1");
    }

    return legacyPath;
  }

  private sendMessageFromContent(aMessage: any) {
    const responses: any[] = [];
    const callback = (aResponse: any) => {
      responses.push(aResponse);
    };
    return MaybePromise.resolve(
        this.events.listenersMap.onMessage.emit(aMessage, null, callback),
    ).then(() => {
      if (responses.length === 0) return;
      if (responses.length === 1) return responses[0];
      throw new Error("Got multiple responses!");
    }).toPromise();
  }
}
