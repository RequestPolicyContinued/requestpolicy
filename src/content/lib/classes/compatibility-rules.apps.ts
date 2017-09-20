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

/// <reference path="./compatibility-rules.d.ts" />

// ===========================================================================
// ApplicationCompatibilityRules
// ===========================================================================

export class ApplicationCompatibilityRules {
  private spec: any;
  private rules: any;
  private appName: string;

  constructor(aSpec: any) {
    this.rules = [];
    this.spec = aSpec;
    this.update();
  }

  public forEach(aCallback: ForEachCallback) {
    this.rules.forEach(([origin, dest]: Rule) => {
      aCallback({origin, dest, info: this.appName});
    });
  }

  private update() {
    browser.runtime.getBrowserInfo().
        then((appInfo: any) => {
          this.appName = appInfo.name;
          this.rules = this.getAppCompatRules(this.appName);
          return;
        }).
        catch((e: any) => {
          console.error("Could not update app compatibility.");
          console.dir(e);
        });
  }

  private getAppCompatRules(appName: string) {
    const rules: Rule[] = [];

    const addRules = (rule: Rule) => {
      rules.push(rule);
    };
    this.spec.all.forEach(addRules);
    if (this.spec.hasOwnProperty(appName)) {
      this.spec[appName].forEach(addRules);
    }

    return rules;
  }
}
