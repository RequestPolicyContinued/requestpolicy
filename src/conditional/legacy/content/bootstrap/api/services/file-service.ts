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

import { API, JSMs, XPCOM } from "bootstrap/api/interfaces";

// =============================================================================

declare const Ci: XPCOM.nsXPCComponents_Interfaces;

const REQUESTPOLICY_DIR = "requestpolicy";

// =============================================================================

export class FileService {
  constructor(
      private xpc: API.IXPConnectService,
      private mozFileUtils: JSMs.FileUtils,
  ) {}

  public getRPFile(aPath: string) {
    return this.getProfileFile(this.getRPPath(aPath));
  }

  public getRPDir(aPath: string, shouldCreate?: boolean) {
    return this.getProfileDir(this.getRPPath(aPath), shouldCreate);
  }

  public getAllRPFiles(aDir?: {
      path: string,
      file: XPCOM.nsIFile,
  }): string[] {
    const dirPath = aDir ? aDir.path : "";
    const dirFile = aDir ? aDir.file : this.getRPFile(dirPath);
    if (!dirFile.exists()) return [];
    const entries = dirFile.directoryEntries;
    let files: string[] = [];
    while (entries.hasMoreElements()) {
      const file: XPCOM.nsIFile = entries.getNext().QueryInterface(Ci.nsIFile);
      const path: string = (dirPath ? `${dirPath}/` : "") + file.leafName;
      if (file.isFile()) {
        files.push(path);
      } else if (file.isDirectory()) {
        files = files.concat(this.getAllRPFiles({path, file}));
      }
    }
    return files;
  }

  public fileToString(file: XPCOM.nsIFile): string {
    const stream = this.xpc.createFileInputStreamInstance();
    stream.init(file, 0x01, 0o444, 0);
    stream.QueryInterface(Ci.nsILineInputStream);

    const cstream = this.xpc.createConverterInputStreamInstance();
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
  public stringToFile(str: string, file: XPCOM.nsIFile) {
    const stream = this.xpc.createFileOutputStreamInstance();
    // write, create, append on write, truncate
    // tslint:disable-next-line no-bitwise
    stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

    const cos = this.xpc.createConverterOutputStreamInstance();
    cos.init(stream, "UTF-8", 4096, 0x0000);
    cos.writeString(str);
    cos.close();
    stream.close();
  }

  private getRPPath(aPath: string) {
    return REQUESTPOLICY_DIR + (aPath ? "/" + aPath : "");
  }

  private getProfileFile(aPath: string) {
    return this.mozFileUtils.getFile("ProfD", aPath.split("/"));
  }

  private getProfileDir(aPath: string, shouldCreate: boolean = true) {
    return this.mozFileUtils.getDir("ProfD", aPath.split("/"), shouldCreate);
  }
}
