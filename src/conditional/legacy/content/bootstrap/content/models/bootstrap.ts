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

enum ArrayType {FIFO, LIFO}

const arrayAddFns: {
  [type: number]: "push" | "unshift",
} = {
  [ArrayType.FIFO]: "push",
  [ArrayType.LIFO]: "unshift",
};

enum BootstrapEvent {onStartup, onShutdown}

const bootstrapFunctions: {
  [event: number]: Array<() => void>,
} = {
  [BootstrapEvent.onStartup]: [],
  [BootstrapEvent.onShutdown]: [],
};

function addBootstrapFn(
    aEvent: BootstrapEvent,
    aArrayType: ArrayType,
    aFn: () => void,
) {
  bootstrapFunctions[aEvent][arrayAddFns[aArrayType]](aFn);
}

function runBootstrapFunctions(aEvent: BootstrapEvent) {
  bootstrapFunctions[aEvent].forEach((fn) => fn());
}

export const Bootstrap = {
  _shutdown: () => runBootstrapFunctions(BootstrapEvent.onShutdown),
  _startup: () => runBootstrapFunctions(BootstrapEvent.onStartup),
  onShutdown(fn: () => void) {
    return addBootstrapFn(BootstrapEvent.onShutdown,
        ArrayType.LIFO, fn);
  },
  onStartup(fn: () => void) {
    return addBootstrapFn(BootstrapEvent.onStartup,
        ArrayType.FIFO, fn);
  },
};
