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

// tslint:disable:class-name
// tslint:disable:interface-name
// tslint:disable:max-line-length
// tslint:disable:no-namespace

export namespace XPCOM {
  export type char = number;
  export type nsResult = number;
  export type nsLoadFlags = number;

  export interface nsISupports {
    QueryInterface<T extends nsISupports>(id: nsIJSID): T;
  }

  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.classes
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.interfaces

  export interface nsIJSID {
    name: string;
    number: string;
    valid: boolean;

    equals(other: nsIJSID): boolean;
    initialize(idString: string): void;
    toString(): string;
  }

  export interface nsIJSCID {
    createInstance(): nsISupports;
    createInstance<T extends nsISupports>(id: nsIJSID): T;
    getService<T extends nsISupports>(id: nsIJSID): T;
  }

  export interface nsIChannel extends nsIRequest {
    asyncOpen(aListener: nsIStreamListener, aContext: nsISupports): void;
    open(): nsIInputStream;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIConverterInputStream.idl
  export interface nsIConverterInputStream extends nsIUnicharInputStream {
    init(
        aStream: nsIInputStream,
        aCharset: string,
        aBufferSize: number,
        aReplacementChar: char,
    ): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIConverterOutputStream.idl
  export interface nsIConverterOutputStream extends nsIUnicharOutputStream {
    init(
        aOutStream: nsIOutputStream,
        aCharset: string,
        aBufferSize: number,
        aReplacementChar: char,
    ): void;
  }

  export interface nsIFile extends nsISupports {
    directoryEntries: nsISimpleEnumerator;
    leafName: string;
    exists(): boolean;
    isFile(): boolean;
    isDirectory(): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIFileStreams.idl
  export interface nsIFileInputStream extends nsIInputStream {
    CLOSE_ON_EOF: number;
    REOPEN_ON_REWIND: number;
    DEFER_OPEN: number;
    SHARE_DELETE: number;

    init(file: nsIFile, ioFlags: number, perm: number, behaviorFlags: number): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIFileStreams.idl
  export interface nsIFileOutputStream extends nsIOutputStream {
    DEFER_OPEN: number;

    init(file: nsIFile, ioFlags: number, perm: number, behaviorFlags: number): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIInputStream.idl
  export interface nsIInputStream extends nsISupports {
    close(): void;
    available(): number;
    isNonBlocking(): boolean;
  }

  interface nsIInterfaceRequestor extends nsISupports {
    getInterface(uuid: nsIJSID): nsIJSID;
  }

  export interface nsILoadGroup extends nsIRequest {
    activeCount: number;
    defaultLoadRequest: nsIRequest;
    groupObserver: nsIRequestObserver;
    notificationCallbacks: nsIInterfaceRequestor;
    requests: nsISimpleEnumerator;

    addRequest(aRequest: nsIRequest, aContext: nsISupports): void;
    removeRequest(aRequest: nsIRequest, aContext: nsISupports, aStatus: nsResult): void;
  }

  export interface nsIObserver_without_nsISupports {
    observe(aSubject: nsISupports, aTopic: string, aData: string): void;
  }
  export type nsIObserver = nsIObserver_without_nsISupports & nsISupports;

  export interface nsIObserverService extends nsISupports {
    addObserver(anObserver: nsIObserver, aTopic: string, ownsWeak: boolean): void;
    enumerateObservers(aTopic: string): nsISimpleEnumerator;
    notifyObservers(aSubject: nsISupports, aTopic: string, someData: string): void;
    removeObserver(anObserver: nsIObserver, aTopic: string): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIOutputStream.idl
  export interface nsIOutputStream extends nsISupports {
    close(): void;
    flush(): void;
    write(aBuf: string, aCount: number): number;
    writeFrom(aFromStream: nsIInputStream, aCount: number): number;
    isNonBlocking(): boolean;
  }

  export interface nsIPrefBranch extends nsISupports {
    addObserver(aDomain: string, aObserver: nsIObserver_without_nsISupports, aHoldWeak: boolean): void;
    clearUserPref(aPrefName: string): void;
    deleteBranch(aStartingAt: string): void;
    getBoolPref(aPrefName: string): boolean;
    getCharPref(aPrefName: string): string;
    getComplexValue(aPrefName: string, aType: nsIJSID): nsIJSID;
    getIntPref(aPrefName: string): number;
    getPrefType(aPrefName: string): number;
    lockPref(aPrefName: string): void;
    prefHasUserValue(aPrefName: string): boolean;
    prefIsLocked(aPrefName: string): boolean;
    removeObserver(aDomain: string, aObserver: nsIObserver_without_nsISupports): void;
    resetBranch(aStartingAt: string): void;
    setBoolPref(aPrefName: string, aValue: boolean): void;
    setCharPref(aPrefName: string, aValue: string): void;
    setComplexValue(aPrefName: string, aType: nsIJSID, aValue: nsISupports): void;
    setIntPref(aPrefName: string, aValue: number): void;
    unlockPref(aPrefName: string): void;
  }

  export type nsIPrefBranch2 = nsIPrefBranch;

  export interface nsIPrefService extends nsISupports {
    getBranch(aPrefRoot: string): nsIPrefBranch;
    getDefaultBranch(aPrefRoot: string): nsIPrefBranch;
    readUserPrefs(aFile: nsIFile): void;
    resetPrefs(): void;
    resetUserPrefs(): void;
    savePrefFile(aFile: nsIFile | null): void;
  }

  interface nsIRequest extends nsISupports {
    LOAD_REQUESTMASK: number;
    LOAD_NORMAL: number;
    LOAD_BACKGROUND: number;
    LOAD_HTML_OBJECT_DATA: number;
    LOAD_DOCUMENT_NEEDS_COOKIE: number;
    INHIBIT_CACHING: number;
    INHIBIT_PERSISTENT_CACHING: number;
    LOAD_BYPASS_CACHE: number;
    LOAD_FROM_CACHE: number;
    VALIDATE_ALWAYS: number;
    VALIDATE_NEVER: number;
    VALIDATE_ONCE_PER_SESSION: number;
    LOAD_ANONYMOUS: number;
    LOAD_FRESH_CONNECTION: number;

    loadFlags: nsLoadFlags;
    loadGroup: nsILoadGroup;
    name: string;
    status: nsResult;

    cancel(aStatus: nsResult): void;
    isPending(): boolean;
    resume(): void;
    suspend(): void;
  }

  interface nsIRequestObserver extends nsISupports {
    onStartRequest(
        aRequest: nsIRequest,
        aContext: nsISupports,
    ): void;
    onStopRequest(
        aRequest: nsIRequest,
        aContext: nsISupports,
        aStatusCode: nsResult,
    ): void;
  }

  interface nsISimpleEnumerator extends nsISupports {
    getNext(): nsISupports;
    hasMoreElements(): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIStreamListener.idl
  interface nsIStreamListener extends nsIRequestObserver {
    onDataAvailable(
        aRequest: nsIRequest,
        aContext: nsISupports,
        aInputStream: nsIInputStream,
        aOffset: number,
        aCount: number,
    ): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIUnicharInputStream.idl
  interface nsIUnicharInputStream extends nsISupports {
    readString(aCount: number, aString: string): number;
    close(): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIUnicharOutputStream.idl
  interface nsIUnicharOutputStream extends nsISupports {
    write(aCount: number, c: char): boolean;
    writeString(str: string): boolean;
    flush(): void;
    close(): void;
  }

  export interface nsIURI extends nsISupports {
    asciiHost: string;
    asciiSpec: string;
    hasRef: boolean;
    host: string;
    hostPort: string;
    originCharset: string;
    password: string;
    path: string;
    port: number;
    prePath: string;
    ref: string;
    scheme: string;
    spec: string;
    specIgnoringRef: string;
    username: string;
    userPass: string;

    clone(): nsIURI;
    cloneIgnoringRef(): nsIURI;
    equals(other: nsIURI): boolean;
    equalsExceptRef(other: nsIURI): boolean;
    resolve(relativePath: string): string;
    schemeIs(scheme: string): boolean;
  }

  export interface nsIVersionComparator extends nsISupports {
    compare(a: string, b: string): number;
  }

  export interface nsIXULAppInfo extends nsISupports {
    appBuildID: string;
    ID: string;
    name: string;
    platformBuildID: string;
    platformVersion: string;
    vendor: string;
    version: string;
  }

  export interface nsIXULRuntime extends nsISupports {
    accessibilityEnabled: boolean;
    browserTabsRemoteAutostart: boolean;
    inSafeMode: boolean;
    is64Bit: boolean;
    logConsoleErrors: boolean;
    OS: string;
    processID: number;
    processType: number;
    widgetToolkit: string;
    XPCOMABI1: string;
  }

  export interface nsXPCComponents {
    classes: nsXPCComponents_Classes;
    interfaces: nsXPCComponents_Interfaces;
  }

  export interface nsXPCComponents_Classes {
    "@mozilla.org/intl/converter-input-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/intl/converter-output-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/network/file-input-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/network/file-output-stream;1": XPCOM.nsIJSCID;
  }

  export interface nsXPCComponents_Interfaces {
    nsIConverterInputStream: XPCOM.nsIJSID;
    nsIConverterOutputStream: XPCOM.nsIJSID;
    nsIFile: XPCOM.nsIJSID;
    nsIFileInputStream: XPCOM.nsIJSID;
    nsIFileOutputStream: XPCOM.nsIJSID;
    nsILineInputStream: XPCOM.nsIJSID;
    nsIPrefBranch2: XPCOM.nsIJSID;
    nsISupportsString: XPCOM.nsIJSID;
  }
}

export namespace JSMs {
  export interface IHttpRequestOptions {
    headers?: string[];
    postData?: string | string[] | null | undefined;
    method: "GET" | "POST" | "PUT";
    onLoad: (
        responseText: XMLHttpRequest["responseText"],
        xhr: XMLHttpRequest,
    ) => void;
    onError: (
        error: any,
        responseText: XMLHttpRequest["responseText"],
        xhr: XMLHttpRequest,
    ) => void;
    logger?: {
      debug: (...args: any[]) => void;
      log: (...args: any[]) => void;
    };
  }
  export interface Http {
    httpRequest(aUrl: string, aOptions: IHttpRequestOptions): XMLHttpRequest;
    percentEncode(aString: string): string;
  }

  export interface FileUtils {
    getFile(key: string, pathArray: string[], followLinks?: boolean): XPCOM.nsIFile;
    getDir(key: string, pathArray: string[], shouldCreate?: boolean, followLinks?: boolean): XPCOM.nsIFile;
    openFileOutputStream(file: XPCOM.nsIFile, modeFlags?: number): XPCOM.nsIFileOutputStream;
    openAtomicFileOutputStream(file: XPCOM.nsIFile, modeFlags?: number): XPCOM.nsIFileOutputStream;
    openSafeFileOutputStream(file: XPCOM.nsIFile, modeFlags?: number): XPCOM.nsIFileOutputStream;
    closeAtomicFileOutputStream(stream: XPCOM.nsIFileOutputStream): void;
    closeSafeFileOutputStream(stream: XPCOM.nsIFileOutputStream): void;
  }

  export interface NetUtil {
    asyncFetch(
        aSource: XPCOM.nsIURI | XPCOM.nsIFile | XPCOM.nsIChannel | XPCOM.nsIInputStream | string,
        aCallback: (
            inputStream: XPCOM.nsIInputStream,
            status: XPCOM.nsResult,
        ) => void,
    ): void;

    newChannel(
        aWhatToLoad: string | XPCOM.nsIURI | XPCOM.nsIFile,
        aOriginCharset?: string,
        aBaseURI?: XPCOM.nsIURI,
    ): XPCOM.nsIChannel;

    newURI(
        aTarget: string | XPCOM.nsIFile,
        aOriginCharset?: string,
        aBaseURI?: XPCOM.nsIURI,
    ): XPCOM.nsIURI;

    readInputStreamToString(
        aInputStream: XPCOM.nsIInputStream,
        aCount: number,
        aOptions?: {
          charset?: string,
          replacement?: XPCOM.char,
        },
    ): string;
  }

  export interface Services {
    appinfo: XPCOM.nsIXULAppInfo & XPCOM.nsIXULRuntime;
    prefs: XPCOM.nsIPrefService & XPCOM.nsIPrefBranch & XPCOM.nsIPrefBranch2;
    vc: XPCOM.nsIVersionComparator;
  }
}

import { Api } from "./api.module";
import { Extension } from "./extension";
import { AsyncLocaleData } from "./i18n/async-locale-data";
import { I18n } from "./i18n/i18n.module";
import { Management } from "./management";
import { Manifest } from "./manifest";
import { MiscInfos } from "./misc-infos";
import { NetworkPredictionEnabledSetting } from "./privacy/network-prediction-enabled";
import { PrivacyApi } from "./privacy/privacy.module";
import { Runtime } from "./runtime";
import { ChromeFileService } from "./services/chrome-file-service";
import { FileService } from "./services/file-service";
import { XPConnectService } from "./services/xpconnect-service";
import { JsonStorage } from "./storage/json-storage";
import {
  IPrefBranchSpec as IPrefBranchSpec_,
  PrefBranch,
  PrefType,
} from "./storage/pref-branch";
import { PrefObserver } from "./storage/pref-observer";
import { Prefs } from "./storage/prefs";
import { Storage } from "./storage/storage.module";
import { SyncLocalStorageArea } from "./storage/sync-local-storage-area";

import * as TryCatchUtils from "lib/utils/try-catch-utils";
import { Log } from "models/log";

export namespace API {
  export namespace extension {
    export type IExtension = Extension;
  }

  export namespace i18n {
    export type II18n = I18n;
    export type IAsyncLocaleData = AsyncLocaleData;
  }

  export namespace management {
    export type IManagement = Management;
  }

  export namespace privacy {
    export namespace network {
      export type networkPredictionEnabled = NetworkPredictionEnabledSetting;
    }

    export type IPrivacy = PrivacyApi;
  }

  export namespace runtime {
    export type IRuntime = Runtime;
  }

  export namespace services {
    export type IChromeFileService = ChromeFileService;
    export type IFileService = FileService;
  }

  export namespace storage {
    export type IStorage = Storage;
    export type IPrefObserver = PrefObserver;
    export type IJsonStorage = JsonStorage;
    export type IPrefBranch = PrefBranch;
    export type IPrefBranchSpec = IPrefBranchSpec_;
    export type IPrefs = Prefs;
    export type ISyncLocalStorageArea = SyncLocalStorageArea;

    export type PrefBranchFactory = (
        branchRoot: string,
        namesToTypesMap: {[key: string]: PrefType},
    ) => IPrefBranch;
    export type PrefObserverFactory = () => PrefObserver;
  }

  export type ILog = Log;
  export type IManifest = Manifest;
  export type IMiscInfos = MiscInfos;
  export type IXPConnectService = XPConnectService;
  export interface ITryCatchUtils {
    getAppLocale: typeof TryCatchUtils.getAppLocale;
    getComplexValueFromPrefBranch: typeof TryCatchUtils.getComplexValueFromPrefBranch;
  }

  export type IApi = Api;
  export type ILegacyApi = Api["legacyApi"];
}
