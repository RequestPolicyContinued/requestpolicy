/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

import {MozModules} from "bootstrap/models/moz-modules";

const {FileUtils: MozFileUtils} = MozModules;

// =============================================================================

declare const Cc: any;
declare const Ci: any;
interface IFile {
  leafName: string;
  exists(): boolean;
  isFile(): boolean;
  isDirectory(): boolean;
}
interface IFileObject {
  [k: string]: IFile;
}

// =============================================================================

const REQUESTPOLICY_DIR = "requestpolicy";

// =============================================================================

export function getRPFile(aPath: string) {
  const path = `${REQUESTPOLICY_DIR}/${aPath}`;
  const pathArray = path.split("/");
  return MozFileUtils.getFile("ProfD", pathArray);
}

export function getAllRPFiles(aDir?: {
    path: string,
    file: IFile,
}): IFileObject {
  const dirPath = aDir ? aDir.path : "requestpolicy";
  const dirFile = aDir ? aDir.file : getRPFile(dirPath);
  if (!dirFile.exists()) return {};
  const entries = dirFile.directoryEntries;
  const files: IFileObject = {};
  while (entries.hasMoreElements()) {
    const file: IFile = entries.getNext().QueryInterface(Ci.nsIFile);
    const path: string = `${dirPath}/${file.leafName}`;
    if (file.isFile()) {
      files[path] = file;
    } else if (file.isDirectory()) {
      Object.assign(files, getAllRPFiles({path, file}));
    }
  }
  return files;
}

export function fileToString(file: IFile): string {
  const stream = Cc["@mozilla.org/network/file-input-stream;1"].
      createInstance(Ci.nsIFileInputStream);
  stream.init(file, 0x01, 0o444, 0);
  stream.QueryInterface(Ci.nsILineInputStream);

  const cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
      createInstance(Ci.nsIConverterInputStream);
  cstream.init(stream, "UTF-8", 0, 0);

  let str = "";
  const data: any = {};
  let read;
  do {
    // Read as much as we can and put it in |data.value|.
    read = cstream.readString(0xffffffff, data);
    str += data.value;
  } while (read !== 0);
  cstream.close(); // This closes |fstream|.

  return str;
}

/**
 * Writes a string to a file (truncates the file if it exists, creates it if
 * it doesn't).
 */
export function stringToFile(str: string, file: IFile) {
  const stream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
  // write, create, append on write, truncate
  // tslint:disable-next-line no-bitwise
  stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

  const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].
      createInstance(Ci.nsIConverterOutputStream);
  cos.init(stream, "UTF-8", 4096, 0x0000);
  cos.writeString(str);
  cos.close();
  stream.close();
}
