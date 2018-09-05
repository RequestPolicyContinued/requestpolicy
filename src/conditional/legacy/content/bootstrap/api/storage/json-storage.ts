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

import { API } from "bootstrap/api/interfaces";
import { C } from "data/constants";

export class JsonStorage implements API.storage.IJsonStorage {
  constructor(
      private filesService: API.services.IFileService,
  ) {}

  public isJsonStorageKey(aKey: string) {
    return aKey.startsWith("policies/") || aKey === "subscriptions";
  }

  public getAll() {
    const allFiles = this.filesService.getAllRPFiles();
    const allPrefs: {[k: string]: any} = {};
    allFiles.forEach((path) => {
      const key = this.getKeyFromPath(path);
      allPrefs[key] = this.get(key);
    });
    return allPrefs;
  }

  public get(aKey: string) {
    this.assertValidKey(aKey);
    const file = this.getFile(aKey);
    if (!file.exists()) return C.UNDEFINED;
    const contents = this.filesService.fileToString(file);
    return JSON.parse(contents);
  }

  public set(aKey: string, aValue: any) {
    this.assertValidKey(aKey);
    const file = this.getFile(aKey);
    const newContents = JSON.stringify(aValue);
    this.filesService.stringToFile(newContents, file);
  }

  public remove(aKey: string) {
    this.assertValidKey(aKey);
    const file = this.getFile(aKey);
    if (!file.exists()) return;
    file.remove(false);
  }

  private assertValidKey(aKey: string) {
    if (!this.isJsonStorageKey(aKey)) {
      throw new Error(`Invalid key "${aKey}".`);
    }
  }

  private getKeyFromPath(aPath: string) {
    return aPath.replace(/\.json$/, "");
  }

  private getFile(aKey: string) {
    return this.filesService.getRPFile(`${aKey}.json`);
  }
}
