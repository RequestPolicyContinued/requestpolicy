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

import { App } from "app/interfaces";
import { XPCOM } from "bootstrap/api/interfaces";
import {HttpChannelWrapper} from "lib/classes/http-channel-wrapper";
import {RequestResult} from "lib/classes/request-result";

// =============================================================================
// Request
// =============================================================================

export class Request {
  // TODO: save a nsIURI objects here instead of strings
  public originURI?: string;
  public destURI: string;

  // TODO: Merge "RequestResult" into this class.
  public requestResult: RequestResult;

  constructor(
      originURI: string | undefined,
      destURI: string,
  ) {
    this.originURI = originURI;
    this.destURI = destURI;
  }

  get originUriObj(): XPCOM.nsIURI | null {
    throw new Error("Not implemented!");
  }

  get destUriObj(): XPCOM.nsIURI {
    throw new Error("Not implemented!");
  }

  public setOriginURI(originURI: string, _: App.services.IUriService) {
    this.originURI = originURI;
  }

  public setDestURI(destURI: string, _: App.services.IUriService) {
    this.destURI = destURI;
  }

  public detailsToString() {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    return "destination: " + this.destURI + ", origin: " + this.originURI;
  }
}

// =============================================================================
// NormalRequest
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class NormalRequest extends Request {
  public shouldLoadResult: number;

  constructor(
      public aContentType: XPCOM.nsContentPolicyType,
      public aContentLocation: XPCOM.nsIURI,
      public aRequestOrigin?: XPCOM.nsIURI | null,
      public aContext?:
          XPCOM.nsIDOMNode | XPCOM.nsIDOMWindow | XPCOM.nsISupports | null,
      public aMimeTypeGuess?: string,
      public aExtra?: any,
      public aRequestPrincipal?: XPCOM.nsIPrincipal,
  ) {
    super(
        // About originURI and destURI:
        // We don't need to worry about ACE formatted IDNs because it seems
        // that they'll automatically be converted to UTF8 format before we
        // even get here, as long as they're valid and Mozilla allows the TLD
        // to have UTF8 formatted IDNs.
        aRequestOrigin ? aRequestOrigin.specIgnoringRef : undefined,
            // originURI
        aContentLocation.specIgnoringRef, // destURI
    );
  }

  get originUriObj() {
    return this.aRequestOrigin || null;
  }

  get destUriObj() {
    return this.aContentLocation;
  }

  public setOriginURI(originURI: string, uriService: App.services.IUriService) {
    this.originURI = originURI;
    this.aRequestOrigin = uriService.getUriObject(originURI);
  }

  public setDestURI(destURI: string, uriService: App.services.IUriService) {
    this.destURI = destURI;
    this.aContentLocation = uriService.getUriObject(destURI);
  }

  get destURIWithRef() {
    return this.aContentLocation.spec;
  }
}

// =============================================================================
// RedirectRequest
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class RedirectRequest extends Request {
  constructor(
      public readonly oldChannel: HttpChannelWrapper,
      // @ts-ignore
      public readonly newChannel: HttpChannelWrapper,
      aFlags: any,
      private oldChannelUri: XPCOM.nsIURI,
      private newChannelUri: XPCOM.nsIURI,
  ) {
    super(
        oldChannelUri.specIgnoringRef,
        newChannelUri.specIgnoringRef,
    );
  }

  get loadFlags() {
    return this.oldChannel.httpChannel.loadFlags;
  }

  get loadInfo() {
    return this.oldChannel.httpChannel.loadInfo;
  }

  get originUriObj() {
    return this.oldChannelUri;
  }

  get destUriObj() {
    return this.newChannelUri;
  }

  get destURIWithRef() {
    return this.newChannelUri.spec;
  }
}
