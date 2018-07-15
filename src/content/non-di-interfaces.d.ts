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

// tslint:disable:no-namespace

import { XPCOM } from "bootstrap/api/interfaces";
import { HttpChannelWrapper } from "lib/classes/http-channel-wrapper";
import { RedirectRequest, NormalRequest } from "lib/classes/request";
import * as RequestProcessor from "lib/request-processor";

export namespace NonDI {
  //
  // factories
  //

  export type RedirectRequestFactory = (
      aOldChannel: HttpChannelWrapper,
      aNewChannel: HttpChannelWrapper,
      aFlags: number,
  ) => RedirectRequest;

  export type NormalRequestFactory = (
      aContentType: any,
      aContentLocation: any,
      aRequestOrigin: any,
      aContext: any,
      aMimeTypeGuess: any,
      aExtra: any,
      aRequestPrincipal: any,
  ) => NormalRequest;

  //
  // singletons
  //

  export type IRequestProcessor = typeof RequestProcessor;
}
