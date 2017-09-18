/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");

//==============================================================================
// Manifest
//==============================================================================

export var Manifest = (function() {
  const uri = "chrome://rpcontinued/content/bootstrap/data/manifest.json";
  const charset = "UTF-8";

  const uriObj = NetUtil.newURI(uri, charset);
  const channel = NetUtil.newChannel(uriObj);
  const inputStream = channel.open();
  const count = inputStream.available();
  const data = NetUtil.readInputStreamToString(inputStream, count, {charset});
  inputStream.close();

  return Object.freeze(JSON.parse(data));
}());
