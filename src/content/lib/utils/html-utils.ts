/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

/**
 * Gets the relevant pieces out of a meta refresh or header refresh string.
 *
 * @return {Object} The delay in seconds and the url to refresh to.
 *     The url may be an empty string if the current url should be
 *     refreshed.
 * @throws Generic exception if the refreshString has an invalid format,
 *     including if the seconds can't be parsed as a float.
 */
export function parseRefresh(
    refreshString: string,
): {
    delay: number,
    destURI: string,
} {
  const parts = /^\s*(\S*?)\s*(;\s*url\s*=\s*(.*?)\s*)?$/i.exec(refreshString);
  if (parts === null) {
    throw new Error("parseRefresh regex did not match");
  }
  const delay = parseFloat(parts[1]);
  if (isNaN(delay)) {
    throw new Error("Invalid delay value in refresh string: " + parts[1]);
  }
  let url = parts[3];
  if (url === undefined) {
    url = "";
  }
  // Strip off enclosing quotes around the url.
  if (url) {
    const first = url[0];
    const last = url[url.length - 1];
    if (first === last && (first === "'" || first === "\"")) {
      url = url.substring(1, url.length - 1);
    }
  }
  return {delay, destURI: url};
}
