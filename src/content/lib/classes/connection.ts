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

import { Module } from "lib/classes/module";
import { defer, IDeferred } from "lib/utils/js-utils";
import { Log } from "models/log";

type Port = browser.runtime.Port;

interface IMessage<T> {
  id: string;
  isResponse: boolean;
  target: string;
  value: T;
}

type messageCallback<TIncoming, TResponseToIncoming> =
    (aType: string, aMessage: TIncoming) => Promise<TResponseToIncoming>;

export class Connection<TIncoming, TResponseToIncoming> extends Module {

  // factory functions

  public static async createSlave<TIncoming, TResponseToIncoming>(
      moduleName: string,
      log: Log,
      targetName: string,
      connectable: {
        onConnect: typeof browser.runtime.onConnect;
      },
      gotMessage: messageCallback<TIncoming, TResponseToIncoming>,
  ): Promise<Connection<TIncoming, TResponseToIncoming>> {
    const port = await new Promise<Port>((resolve, reject) => {
      const onConnectListener = (aPort: Port) => {
        resolve(aPort);
        connectable.onConnect.removeListener(onConnectListener);
      };
      connectable.onConnect.addListener(onConnectListener);
    });
    return new Connection<TIncoming, TResponseToIncoming>(
        moduleName,
        log,
        targetName,
        port,
        gotMessage,
    );
  }

  // properties, constructor

  private expectedResponses = new Map<string, IDeferred<any, any>>();

  constructor(
      moduleName: string,
      log: Log,
      protected targetName: string,
      private port: Port,
      public gotMessage: messageCallback<TIncoming, TResponseToIncoming>,
  ) {
    super(moduleName, log);

    this.port.onMessage.addListener(this.receiveMessage.bind(this));
    this.port.postMessage(this.buildMessage("startup", "ready", false));
  }

  // methods

  public sendMessage<T, TResponse>(
      id: string,
      value: T,
  ): Promise<TResponse> {
    if (this.expectedResponses.has(id)) {
      const errorMsg =
          `There's already a pending response for message id "${id}"`;
      this.log.error(errorMsg);
      const error = new Error(errorMsg);
      return Promise.reject(error);
    }

    const dResponse = defer<TResponse>();
    this.expectedResponses.set(id, dResponse);

    const message = this.buildMessage(id, value, false);
    this.port.postMessage(message);
    return dResponse.promise;
  }

  private receiveMessage(aMessage: IMessage<any>): void {
    if (aMessage.target !== this.moduleName) return;
    if (aMessage.id === "startup" && aMessage.value === "ready") {
      this.setSelfReady();
      if (!aMessage.isResponse) {
        this.port.postMessage(this.buildMessage("startup", "ready", true));
      }
      return;
    }
    if (aMessage.isResponse) {
      if (!this.expectedResponses.has(aMessage.id)) {
        this.log.error(
            `No listener available response with id "${aMessage.id}"`,
            aMessage,
        );
      } else {
        const d: IDeferred<any, any> =
            this.expectedResponses.get(aMessage.id)!;
        this.expectedResponses.delete(aMessage.id);
        d.resolve(aMessage.value);
      }
    } else {
      this.gotMessage(aMessage.id, aMessage.value).
          then(this.sendResponse.bind(this, aMessage.id)).
          catch(this.log.onError(`receiveMessage()`, aMessage));
    }
  }

  private sendResponse<TResponse>(id: string, value: TResponse): void {
    this.port.postMessage(this.buildMessage(id, value, true));
  }

  private buildMessage<T>(
      id: string,
      value: T,
      isResponse: boolean,
  ): IMessage<T> {
    return {
      id,
      isResponse,
      target: this.targetName,
      value,
    };
  }
}
