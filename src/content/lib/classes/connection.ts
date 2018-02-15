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
import { createListenersMap } from "lib/utils/listener-factories";
import { Log } from "models/log";

type Port = browser.runtime.Port;

interface IMessage<T> {
  id: string;
  isResponse: boolean;
  target: string;
  value: T;
}

export class Connection<TRx, TRxResp> extends Module {
  private events = createListenersMap(["onMessage"]);
  public get onMessage() { return this.events.interfaces.onMessage; }

  private dConnectionReady = defer<void>();

  private expectedResponses = new Map<string, IDeferred<any, any>>();
  private port: Port;

  constructor(
      moduleName: string,
      log: Log,
      protected targetName: string,
      private pPort: Promise<Port>,
  ) {
    super(moduleName, log);
  }

  public async startupSelf() {
    this.port = await this.pPort;
    this.port.onMessage.addListener(this.receiveMessage.bind(this));
    this.port.postMessage(this.buildMessage("startup", "ready", false));
    // NOTE: the startup is NOT done yet
    await this.dConnectionReady.promise;
  }

  // methods

  public sendMessage<TTx, TTxResp>(value: TTx): Promise<TTxResp> {
    const id = String(Math.random());
    const dResponse = defer<TTxResp>();
    this.expectedResponses.set(id, dResponse);

    const message = this.buildMessage(id, value, false);
    this.port.postMessage(message);
    return dResponse.promise;
  }

  private receiveMessage(aMessage: IMessage<any>): void {
    if (aMessage.target !== this.moduleName) return;
    if (aMessage.id === "startup" && aMessage.value === "ready") {
      this.dConnectionReady.resolve(undefined);
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
      this.gotMessage(aMessage.value).
          then(this.sendResponse.bind(this, aMessage.id)).
          catch(this.log.onError(`receiveMessage()`, aMessage));
    }
  }

  private async gotMessage(aMessage: TRx): Promise<TRxResp | void> {
    const responsesRaw: TRxResp[] | Promise<TRxResp[]> =
        this.events.listenersMap.onMessage.emit(aMessage);
    let responses: TRxResp[];
    if (
        responsesRaw &&
        typeof (responsesRaw as Promise<TRxResp[]>).then === "function"
    ) {
      responses = await responsesRaw;
    } else {
      responses = responsesRaw as TRxResp[];
    }
    responses = responses.filter((response) => !!response);
    if (responses.length === 0) {
      return;
    }
    if (responses.length > 1) {
      return Promise.reject("Got multiple responses!");
    }
    return responses[0];
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
