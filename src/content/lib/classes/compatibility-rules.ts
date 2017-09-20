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

import {ApplicationCompatibilityRules} from "./compatibility-rules.apps";
import {ExtensionCompatibilityRules} from "./compatibility-rules.extensions";

// =============================================================================
// CompatibilityRules
// =============================================================================

export class CompatibilityRules {
  private app: ApplicationCompatibilityRules;
  private extensions: ExtensionCompatibilityRules;

  constructor(aAppCompatibilitySpec: any, aExtensionCompatibilitySpec: any) {
    this.app = new ApplicationCompatibilityRules(aAppCompatibilitySpec);
    this.extensions = new ExtensionCompatibilityRules(
        aExtensionCompatibilitySpec);
  }

  public forEach(aCallback: ForEachCallback) {
    this.app.forEach(aCallback);
    this.extensions.forEach(aCallback);
  }

  public checkBaseUriWhitelist(aBaseUri: BaseUri) {
    return this.extensions.checkBaseUriWhitelist(aBaseUri);
  }

  public getTopLevelDocTranslation(aUri: string): Dest | null {
    return this.extensions.getTopLevelDocTranslation(aUri);
  }
}
