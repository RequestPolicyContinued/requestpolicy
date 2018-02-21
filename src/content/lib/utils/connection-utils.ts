/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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

type Port = browser.runtime.Port;

export function getPortFromSlaveConnectable(
    connectable: {
      onConnect: typeof browser.runtime.onConnect;
      onMessage: typeof browser.runtime.onMessage;
    },
): Promise<Port> {
  return new Promise<Port>((resolve, reject) => {
    const onConnectListener = (aPort: Port) => {
      resolve(aPort);
      connectable.onConnect.removeListener(onConnectListener);
    };
    connectable.onConnect.addListener(onConnectListener);

    const onMessageListener = (
        message: any,
        sender: browser.runtime.MessageSender,
        sendResponse: (response: any) => void,
    ) => {
      if (message === "isConnectionSlaveReady") {
        sendResponse("connectionSlaveIsReady");
        connectable.onMessage.removeListener(onMessageListener);
      }
    };
    connectable.onMessage.addListener(onMessageListener);
  });
}

export function getPortFromMasterConnectable(
    connectable: {
      sendMessage: typeof browser.runtime.sendMessage;
      connect: typeof browser.runtime.connect;
    },
    maxTries: number = 100,
): Promise<Port> {
  return new Promise(async (resolve, reject) => {
    let response: any;
    let i = -1;
    do {
      ++i;
      console.log(`trying to connect to slave, try #${i}`);
      if (i >= maxTries) {
        reject(`slave did not respond, even after ${maxTries} tries`);
        return;
      }
      try {
        response = await connectable.sendMessage("isConnectionSlaveReady");
      } catch (e) {
        // uncomment for inspection
        console.dir(e);
      }
    } while (response !== "connectionSlaveIsReady");
    resolve();
  }).then(() => browser.runtime.connect());
}
