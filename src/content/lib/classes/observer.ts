/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

declare const Services: any;

// "known" observer topics
export type XPCOMObserverTopic = "sessionstore-windows-restored";

type XPCOMObserverCallback =
    (subject: any, topic: XPCOMObserverTopic, data: any) => void;

export class XPCOMObserver {
  private observer: {observe: XPCOMObserverCallback};
  private isRegistered: boolean = false;
  private topics: XPCOMObserverTopic[] = [];

  constructor(
      aTopics: XPCOMObserverTopic[] | XPCOMObserverTopic,
      aCallback: XPCOMObserverCallback,
  ) {
    this.topics = Array.isArray(aTopics) ? aTopics : [aTopics];
    this.observer = {observe: aCallback};
    this.register();
  }

  public register() {
    if (this.isRegistered) return;
    this.topics.forEach((topic) => {
      Services.obs.addObserver(this, topic, false);
    });
    this.isRegistered = true;
  }
  public unregister() {
    if (!this.isRegistered) return;
    this.topics.forEach((topic) => {
      Services.obs.removeObserver(this, topic);
    });
    this.isRegistered = false;
  }
}
