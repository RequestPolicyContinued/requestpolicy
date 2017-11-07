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

import {
  XPCOMObserver,
  XPCOMObserverTopic,
} from "content/lib/classes/xpcom-observer";
import {defer} from "content/lib/utils/js-utils";

export function promiseObserverTopic(aTopic: XPCOMObserverTopic) {
  const deferred = defer<[any, string, any]>();

  function callback(subject: any, topic: string, data: any) {
    observer.unregister();
    deferred.resolve([subject, topic, data]);
  }

  const observer = new XPCOMObserver(aTopic, callback);

  return deferred.promise;
}
