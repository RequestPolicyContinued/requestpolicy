/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */


const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
const {httpRequest} = Cu.import("resource://gre/modules/Http.jsm");

/**
 * Return the complete chrome url based on a relative path to
 * RequestPolicy main dir (i.e chrome://rpcontinued/<path>).
 *
 * @param {string} path Relative path from RequestPolicy main dir
 * @return {string} Chrome URL
 */
export function getChromeUrl(path) {
 // Removes leading ./ or / and append to chrome://rpcontinued/
 const replacer = /^(?:\.\/|\/)?(.+)$/mg;
 return path.replace(replacer, "chrome://rpcontinued/$1");
}

/**
 * Return a promise which is fullfilled with an array containing
 * the content of the chrome directory. A file or directory is
 * represented as on object with name and isDir properties.
 *
 * @param {string} chromeUrl
 * @return {Promise}
 */
export function readDirectory(chromeUrl) {
  if (!chromeUrl) {
    return Promise.reject(new Error("Invalid null argument"));
  } else if (!chromeUrl.endsWith("/")) {
    chromeUrl = chromeUrl + "/";
  }

  return sendHttpGet(chromeUrl).then(responseText => {
    let fileList = [];
    // The http response contains in each line:
    // 201: filename content-length last-modified file-type
    // We capture the filename and file-type
    const extractor = /^201:\s(\S+)\s+\d+\s+\S+\s+(\S+)\s*$/gm;
    let entry;
    const nextEntry = () => {
      entry = extractor.exec(responseText);
      return entry;
    };
    while (nextEntry()) {
      fileList.push({
        name: entry[1],
        isDir: entry[2].toLowerCase() === "directory",
      });
    }

    return Promise.resolve(fileList);
  });
}

/**
 * Return a promise which is fullfilled with the Object
 * from the converted JSON string.
 * @param {string} chromeUrl
 * @return {Promise}
 */
export function parseJSON(chromeUrl) {
  return new Promise((resolve, reject) => {
    try {
      NetUtil.asyncFetch(chromeUrl, (inputStream, status) => {
        try {
          if (!isSuccessCode(status)) {
            // Convert status code to a string
            // eslint-disable-next-line new-cap
            reject(new Error(`Enable to load '${chromeUrl}': ${status}`));
            return;
          }
          let text = NetUtil.readInputStreamToString(inputStream,
            inputStream.available(), {charset: "utf-8"});
          inputStream.close();
          resolve(JSON.parse(text));
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Return a promise which is fulfilled with the response text
 * of the HTTP GET request. The promise is rejected with an Error if the
 * status code isn't 200 or upon any other errors.
 * @param {string} url
 * @return {Promise}
 */
function sendHttpGet(url) {
  return new Promise((resolve, reject) => {
    try {
      const xhrOptions = {
        method: "GET",
        onLoad: function(responseText, xhr) {
          if (xhr && xhr.status === 200) {
            resolve(responseText);
          } else {
            reject(new Error(`Invalid status code when reading '${url}'`));
          }
        },
        onError: function(error) {
          reject(new Error(`Error reading '${url}': ${error}`));
        },
      };

      httpRequest(url, xhrOptions);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Determines whether a given XPCOM return code (that is, an nsresult value)
 * indicates the success or failure of an operation, returning true or false
 * respectively.
 * An XPCOM return code indicates success if its high-order bit is 0, and
 * it indicates failure if its high-order bit is 1.
 * see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.isSuccessCode
 *
 * @param {nsresult} returnCode XPCOM return code to check
 * @return {boolean}
 */
function isSuccessCode(returnCode) {
  return (returnCode & 0x80000000) === 0;
}
