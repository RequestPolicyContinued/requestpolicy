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
  export type ACString = string;
  export type AString = string;
  export type char = number;
  export type DOMString = string;
  export type jsval = any;
  export type nsContentPolicyType = number;
  export type nsLoadFlags = number;
  export type nsresult = number;
  export type wstring = string;
  export type nsIIDRef = nsIJSID;

  export interface nsISupports {
    QueryInterface<T extends nsISupports>(id: nsIJSID): T;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/base/nsIWeakReference.idl
  export interface nsISupportsWeakReference {
    GetWeakReference<T extends nsISupports>(): nsIWeakReference<T>;
  }

  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.classes
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.interfaces

  export interface nsIJSID extends Function {
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


  // https://dxr.mozilla.org/comm-esr45/source/mozilla/js/xpconnect/idl/mozIJSSubScriptLoader.idl
  export interface mozIJSSubScriptLoader extends nsISupports {
    loadSubScript(url: AString, obj?: jsval, charset?: AString): jsval;
    loadSubScriptWithOptions(url: AString, options: jsval): jsval;
    precompileScript(uri: nsIURI, principal: nsIPrincipal, observer: nsIObserver): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIAsyncVerifyRedirectCallback.idl
  export interface nsIAsyncVerifyRedirectCallback extends nsISupports {
    onRedirectVerifyCallback(result: nsresult): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/components/nsICategoryManager.idl
  export interface nsICategoryManager extends nsISupports {
    addCategoryEntry(
        aCategory: string,
        aEntry: string,
        aValue: string,
        aPersist: boolean,
        aReplace: boolean,
    ): string;
    deleteCategoryEntry(aCategory: string, aEntry: string, aPersist: boolean): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIChannel.idl
  export interface nsIChannel extends nsIRequest {
    readonly loadInfo: nsILoadInfo;
    originalURI: nsIURI;
    readonly URI: nsIURI;
    notificationCallbacks: nsIInterfaceRequestor;
    asyncOpen(aListener: nsIStreamListener, aContext: nsISupports): void;
    open(): nsIInputStream;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/components/nsIComponentManager.idl
  export interface nsIComponentManager extends nsISupports {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/components/nsIComponentRegistrar.idl
  export interface nsIComponentRegistrar extends nsISupports {
    registerFactory(
        aClass: nsIJSCID,
        aClassName: string,
        aContractID: string,
        aFactory: nsIFactory,
    ): void;
    unregisterFactory(
        aClass: nsIJSCID,
        aFactory: nsIFactory,
    ): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  export interface nsIContentFrameMessageManager extends nsIMessageManagerGlobal {
    readonly content: XUL.contentWindow;
    readonly docShell: nsIDocShell;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIContentPolicy.idl
  export interface nsIContentPolicy extends nsIContentPolicyBase {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIContentPolicyBase.idl
  interface nsIContentPolicyBase extends nsISupports {}


  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  export interface nsIContentProcessMessageManager extends nsIMessageManagerGlobal {
    readonly initialProcessData: jsval;
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

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIDirectoryService.idl
  export interface nsIDirectoryService extends nsISupports {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/base/nsIDocShell.idl
  export interface nsIDocShell extends nsIDocShellTreeItem {
    allowPlugins: boolean;
    allowJavascript: boolean;
    allowMetaRedirects: boolean;
    allowSubframes: boolean;
    allowImages: boolean;
    allowMedia: boolean;
    allowDNSPrefetch: boolean;
    allowWindowControl: boolean;
    allowContentRetargeting: boolean;
    allowContentRetargetingOnChildren: boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/base/nsIDocShellTreeItem.idl
  export interface nsIDocShellTreeItem extends nsISupports {
	  readonly rootTreeItem: nsIDocShellTreeItem;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/core/nsIDOMDocument.idl
  export interface nsIDOMDocument extends nsIDOMNode {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/core/nsIDOMElement.idl
  export interface nsIDOMElement extends nsIDOMNode {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/core/nsIDOMNode.idl
  export interface nsIDOMNode extends nsISupports {
    readonly localName: string;
    readonly nodeName: string;
    readonly nodeType: number;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/base/nsIDOMWindow.idl
  export interface nsIDOMWindow extends nsISupports, Window {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/base/nsIDOMWindowUtils.idl
  export interface nsIDOMWindowUtils extends nsISupports {
    readonly outerWindowID: number;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/interfaces/xul/nsIDOMXULElement.idl
  export interface nsIDOMXULElement extends nsIDOMElement {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/dns/nsIEffectiveTLDService.idl
  export interface nsIEffectiveTLDService extends nsISupports {
    getBaseDomainFromHost(
        aHost: string,
        aAdditionalParts?: number,
    ): string;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/threads/nsIEventTarget.idl
  interface nsIEventTarget extends nsISupports {
    DISPATCH_NORMAL: 0;
    DISPATCH_SYNC: 1;
    isOnCurrentThread(): boolean;
    dispatch(event: nsIRunnable_without_nsISupports, flags: number): void;
  }

  export interface nsIFactory {}

  export interface nsIFile extends nsISupports {
    directoryEntries: nsISimpleEnumerator;
    diskSpaceAvailable: number;
    fileSize: number;
    fileSizeOfLink: number;
    followLinks: boolean;
    lastModifiedTime: number;
    lastModifiedTimeOfLink: number;
    leafName: string;
    parent: nsIFile;
    path: string;
    permissions: number;
    permissionsOfLink: number;
    persistentDescriptor: string;
    target: string;

    append(node: string): void;
    appendRelativePath(relativeFilePath: string): void;
    clone(): nsIFile;
    contains(inFile: nsIFile): boolean;
    copyTo(newParentDir: nsIFile, newName: string): void;
    copyToFollowingLinks(newParentDir: nsIFile, newName: string): void;
    create(type: number, permissions: number): void;
    createUnique(type: number, permissions: number): void;
    equals(inFile: nsIFile): boolean;
    exists(): boolean;
    getRelativeDescriptor(fromFile: nsIFile): string;
    initWithFile(aFile: nsIFile): void;
    initWithPath(filePath: string): void;
    isDirectory(): boolean;
    isExecutable(): boolean;
    isFile(): boolean;
    isHidden(): boolean;
    isReadable(): boolean;
    isSpecial(): boolean;
    isSymlink(): boolean;
    isWritable(): boolean;
    launch(): void;
    moveTo(newParentDir: nsIFile, newName: string): void;
    normalize(): void;
    remove(recursive: boolean): void;
    renameTo(newParentDir: nsIFile, newName: string): void;
    reveal(): void;
    setRelativeDescriptor(fromFile: nsIFile, relativeDesc: string): void;
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

  interface nsIProcessChecker extends nsISupports {
    killChild(): boolean;
    assertPermission(aPermission: DOMString): boolean;
    assertContainApp(aManifestURL: DOMString): boolean;
    assertAppHasPermission(aPermission: DOMString): boolean;
    assertAppHasStatus(aStatus: number): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIProcessScriptLoader extends nsISupports {
    loadProcessScript(aURL: AString, aAllowDelayedLoad: boolean): void;
    removeDelayedProcessScript(aURL: AString): void;
    getDelayedProcessScripts(): jsval;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/embedding/components/windowwatcher/nsIPromptService.idl
  export interface nsIPromptService extends nsISupports {
    confirmCheck(
        aParent: nsIDOMWindow,
        aDialogTitle: wstring,
        aText: wstring,
        aCheckMsg: wstring,
        aCheckState: {
          value: boolean,
        },
    ): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/embedding/components/windowwatcher/nsIPromptService2.idl
  export interface nsIPromptService2 extends nsIPromptService {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/ds/nsIProperties.idl
  export interface nsIProperties extends nsISupports {
    get<T extends nsISupports>(prop: string, iid: nsIJSID): T;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/protocol/file/nsIFileProtocolHandler.idl
  export interface nsIFileProtocolHandler extends nsIProtocolHandler {
    getURLSpecFromDir(file: nsIFile): string;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIFrameScriptLoader extends nsISupports {
    loadFrameScript(
      aURL: AString,
      aAllowDelayedLoad: boolean,
      aRunInGlobalScope?: boolean,
    ): void;
    removeDelayedFrameScript(aURL: AString): void;
    getDelayedFrameScripts(): jsval;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIGlobalProcessScriptLoader extends nsIProcessScriptLoader {
    readonly initialProcessData: jsval;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/protocol/http/nsIHttpChannel.idl
  export interface nsIHttpChannel extends nsIChannel {
    referrer: nsIURI;
    getRequestHeader(aHeader: string): string;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/dns/nsIIDNService.idl
  export interface nsIIDNService extends nsISupports {
    convertToDisplayIDN(input: string, isASCII: {}): string;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/io/nsIInputStream.idl
  export interface nsIInputStream extends nsISupports {
    close(): void;
    available(): number;
    isNonBlocking(): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/base/nsIInterfaceRequestor.idl
  interface nsIInterfaceRequestor extends nsISupports {
    getInterface<T extends nsISupports>(uuid: nsIJSID): T;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIIOService.idl
  interface nsIIOService extends nsISupports {
    getProtocolHandler(aScheme: string): nsIProtocolHandler;
    newChannelFromURI?: (aURI: nsIURI) => nsIChannel;
    newChannelFromURIWithLoadInfo?: (
        aURI: nsIURI,
        aLoadInfo: nsILoadInfo,
    ) => nsIChannel;
    newURI(
        aSpec: string,
        aOriginCharset: string | null,
        aBaseURI: nsIURI | null,
    ): nsIURI;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIIOService2.idl
  interface nsIIOService2 extends nsIIOService {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/base/nsILoadContext.idl
  export interface nsILoadContext extends nsISupports {
    readonly associatedWindow: nsIDOMWindow;
    readonly topWindow: nsIDOMWindow;
    readonly topFrameElement: nsIDOMElement;
    readonly nestedFrameId: number;
    readonly isContent: boolean;
  }

  export interface nsILoadGroup extends nsIRequest {
    activeCount: number;
    defaultLoadRequest: nsIRequest;
    groupObserver: nsIRequestObserver;
    notificationCallbacks: nsIInterfaceRequestor;
    requests: nsISimpleEnumerator;

    addRequest(aRequest: nsIRequest, aContext: nsISupports): void;
    removeRequest(aRequest: nsIRequest, aContext: nsISupports, aStatus: nsresult): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsILoadInfo.idl
  export interface nsILoadInfo extends nsISupports {
    externalContentPolicyType: nsContentPolicyType;
  }

  interface nsILocale extends nsISupports {
    getCategory(category: string): string;
  }

  export interface nsILocaleService extends nsISupports {
    getApplicationLocale(): nsILocale;
    getLocaleComponentForUserAgent(): string;
    getLocaleFromAcceptLanguage(acceptLanguage: string): nsILocale;
    getSystemLocale(): nsILocale;
    newLocale(aLocale: string): nsILocale;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIMessageBroadcaster extends nsIMessageListenerManager {
    broadcastAsyncMessage(
      messageName?: AString,
      obj?: jsval,
      objects?: jsval,
    ): void;

    readonly childCount: number;
    getChildAt(aIndex: number): nsIMessageListenerManager;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIMessageListener extends nsISupports {
    receiveMessage: (data: {
      target: any,         /* the target of the message. Either an element owning
                              the message manager, or message manager itself if no
                              element owns it */
      name: string,        /* message name */
      sync: boolean,
      data: any,           /* structured clone of the sent message data */
      objects: any,        /* named table of jsvals/objects, or null */
      principal: any,      /* principal for the window app */
    }) => void;
  }

  type MessageListener = nsIMessageListener | nsIMessageListener["receiveMessage"];

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIMessageListenerManager extends nsISupports {
    addMessageListener(
      messageName: AString,
      listener: MessageListener,
      listenWhenClosed?: boolean,
    ): void;
    removeMessageListener(
      messageName: AString,
      listener: MessageListener,
    ): void;
    addWeakMessageListener(
      messageName: AString,
      listener: MessageListener,
    ): void;
    removeWeakMessageListener(
      messageName: AString,
      listener: MessageListener,
    ): void;
  }

  export type nsIMessageManager = nsIMessageManagerGlobal;

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  export interface nsIMessageManagerGlobal extends nsISyncMessageSender {
    dump(aStr: DOMString): void;
    privateNoteIntentionalCrash(): void;
    atob(aAsciiString: DOMString): DOMString;
    btoa(aBase64Data: DOMString): DOMString;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsIMessageSender extends nsIMessageListenerManager {
    sendAsyncMessage(
      messageName?: string,
      obj?: jsval,
      objects?: jsval,
      principal?: nsIPrincipal,
    ): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsIMessageManager.idl
  interface nsISyncMessageSender extends nsIMessageSender {
    sendSyncMessage(
      messageName?: AString,
      obj?: jsval,
      objects?: jsval,
      principal?: nsIPrincipal,
    ): jsval;
    sendRpcMessage(
      messageName?: AString,
      obj?: jsval,
      objects?: jsval,
      principal?: nsIPrincipal,
    ): jsval;
  }

  export interface nsIObserver_without_nsISupports<T extends nsISupports = nsISupports> {
    observe(aSubject: T, aTopic: string, aData: string): void;
  }
  export type nsIObserver<T extends nsISupports = nsISupports> =
      nsIObserver_without_nsISupports<T> & nsISupports;

  export interface nsIObserverService extends nsISupports {
    addObserver(anObserver: nsIObserver_without_nsISupports, aTopic: string, ownsWeak: boolean): void;
    enumerateObservers(aTopic: string): nsISimpleEnumerator;
    notifyObservers(aSubject: nsISupports | null, aTopic: string, someData: string): void;
    removeObserver(anObserver: nsIObserver_without_nsISupports, aTopic: string): void;
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
    getChildList(aStartingAt: string, aCount?: {value: number}): string[];
    getComplexValue<T extends nsISupports>(aPrefName: string, aType: nsIJSID): T;
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

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/caps/nsIPrincipal.idl
  export interface nsIPrincipal extends nsISerializable {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIProtocolHandler.idl
  export interface nsIProtocolHandler extends nsISupports {}

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/netwerk/base/nsIRequest.idl
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
    status: nsresult;

    cancel(aStatus: nsresult): void;
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
        aStatusCode: nsresult,
    ): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/threads/nsIRunnable.idl
  export interface nsIRunnable_without_nsISupports {
    run(): void;
  }

  type nsIRunnable = nsIRunnable_without_nsISupports & nsISupports;

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/shistory/nsISHEntry.idl
  export interface nsISHEntry extends nsISupports {
    readonly URI: nsIURI;
    originalURI: nsIURI;
    loadReplace: boolean;
    readonly title: wstring;
    readonly isSubFrame: boolean;
    setURI(aURI: nsIURI): void;
    referrerURI: nsIURI;
    referrerPolicy: number;
    // contentViewer: nsIContentViewer;
    sticky: boolean;
    windowState: nsISupports;

    addChildShell(shell: nsIDocShellTreeItem): void;
    childShellAt(index: number): nsIDocShellTreeItem;
    clearChildShells(): void;
    // refreshURIList: nsISupportsArray;
    syncPresentationState(): void;
    setTitle(aTitle: AString): void;
    postData: nsIInputStream;
    // layoutHistoryState: nsILayoutHistoryState;
    parent: nsISHEntry;
    loadType: number;
    ID: number;
    cacheKey: nsISupports;
    saveLayoutStateFlag: boolean;
    expirationStatus: boolean;
    contentType: ACString;
    URIWasModified: boolean;

    setScrollPosition(x: number, y: number): void;
    getScrollPosition(x: number, y: number): void;
    clone(): nsISHEntry;
    setIsSubFrame(aFlag: boolean): void;

    // getAnyContentViewer(ownerEntry: nsISHEntry): nsIContentViewer;
    owner: nsISupports;
    // stateData: nsIStructuredCloneContainer;

    isDynamicallyAdded(): boolean;
    hasDynamicallyAddedChild(): boolean;
    docshellID: number;

    // readonly BFCacheEntry: nsIBFCacheEntry;
    adoptBFCacheEntry(aEntry: nsISHEntry): void;
    abandonBFCacheEntry(): void;
    sharesDocumentWith(aEntry: nsISHEntry): boolean;
    readonly isSrcdocEntry: boolean;
    srcdocData: AString;
    baseURI: nsIURI;
  }

    // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/shistory/nsISHistory.idl
  export interface nsISHistory extends nsISupports {
    readonly count: number;
    readonly index: number;
    readonly requestedIndex: number;
    maxLength: number;

    getEntryAtIndex(index: number, modifyIndex: boolean): nsISHEntry;
    PurgeHistory(numEntries: number): void;
    addSHistoryListener(aListener: nsISHistoryListener): void;
    removeSHistoryListener(aListener: nsISHistoryListener): void;
    readonly SHistoryEnumerator: nsISimpleEnumerator;
    reloadCurrentEntry(): void;
    getIndexOfEntry(aEntry: nsISHEntry): number;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/shistory/nsISHistoryListener.idl
  export interface nsISHistoryListener extends nsISupports {
    OnHistoryNewEntry(aNewURI: nsIURI): void;
    OnHistoryGoBack(aBackURI: nsIURI): boolean;
    OnHistoryGoForward(aForwardURI: nsIURI): boolean;
    OnHistoryReload(aReloadURI: nsIURI, aReloadFlags: number): boolean;
    OnHistoryGotoIndex(aIndex: number, aGotoURI: nsIURI): boolean;
    OnHistoryPurge(aNumEntries: number): boolean;
    OnHistoryReplaceEntry(aIndex: number): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/caps/nsIScriptSecurityManager.idl
  export interface nsIScriptSecurityManager extends nsISupports {
    isSystemPrincipal(aPrincipal: nsIPrincipal): boolean;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/ds/nsISerializable.idl
  interface nsISerializable extends nsISupports {}

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

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/layout/base/nsIStyleSheetService.idl
  interface nsIStyleSheetService extends nsISupports {
    AGENT_SHEET: 0;
    USER_SHEET: 1;
    AUTHOR_SHEET: 2;

    loadAndRegisterSheet(sheetURI: nsIURI, type: number): void;
    sheetRegistered(sheetURI: nsIURI, type: number): boolean;
    unregisterSheet(sheetURI: nsIURI, type: number): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/ds/nsISupportsPrimitives.idl
  interface nsISupportsPrimitive extends nsISupports {
    type: number;

    TYPE_ID:                 1;  // nsISupportsID
    TYPE_CSTRING:            2;  // nsISupportsCString
    TYPE_STRING:             3;  // nsISupportsString
    TYPE_PRBOOL:             4;  // nsISupportsPRBool
    TYPE_PRUINT8:            5;  // nsISupportsPRUint8
    TYPE_PRUINT16:           6;  // nsISupportsPRUint16
    TYPE_PRUINT32:           7;  // nsISupportsPRUint32
    TYPE_PRUINT64:           8;  // nsISupportsPRUint64
    TYPE_PRTIME:             9;  // nsISupportsPRTime
    TYPE_CHAR:              10;  // nsISupportsChar
    TYPE_PRINT16:           11;  // nsISupportsPRInt16
    TYPE_PRINT32:           12;  // nsISupportsPRInt32
    TYPE_PRINT64:           13;  // nsISupportsPRInt64
    TYPE_FLOAT:             14;  // nsISupportsFloat
    TYPE_DOUBLE:            15;  // nsISupportsDouble
    TYPE_VOID:              16;  // nsISupportsVoid
    TYPE_INTERFACE_POINTER: 17;  // nsISupportsInterfacePointer
  }

  interface nsISupportsString extends nsISupportsPrimitive {
    type: nsISupportsPrimitive["TYPE_STRING"];
    data: string;
    toString(): string;
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

  interface nsIThread extends nsIEventTarget {
    shutdown(): void;
    hasPendingEvents(): boolean;
    processNextEvent(mayWait: boolean): boolean;
    asyncShutdown(): void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpcom/threads/nsIThreadManager.idl
  export interface nsIThreadManager extends nsISupports {
    DEFAULT_STACK_SIZE: 0;
    newThread(creationFlags: number, stackSize: number): nsIThread;
    readonly mainThread: nsIThread;
    readonly currentThread: nsIThread;
    readonly isMainThread: boolean;
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

  export interface nsIWeakReference<T extends nsISupports> extends nsISupports {
    QueryReferent(uuid: nsIIDRef): T;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/docshell/base/nsIWebNavigation.idl
  export interface nsIWebNavigation extends nsISupports {
    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    goBack(): void;
    goForward(): void;
    gotoIndex(index: number): void;
    loadURI(
        aURI: wstring,
        aLoadFlags: number,
        aReferrer: nsIURI,
        aPostData: nsIInputStream,
        aHeaders: nsIInputStream,
    ): void;
    loadURIWithOptions(
        aURI: wstring,
        aLoadFlags: number,
        aReferrer: nsIURI,
        aReferrerPolicy: number,
        aPostData: nsIInputStream,
        aHeaders: nsIInputStream,
        aBaseURI: nsIURI,
    ): void;
    reload(aReloadFlags: number): void;
    stop(aStopFlags: number): void;
    readonly document: nsIDOMDocument;
    readonly currentURI: nsIURI;
    readonly referringURI: nsIURI;
    readonly sessionHistory: nsISHistory;
  }

  export interface nsIWebProgress extends nsISupports {
    readonly DOMWindow: nsIDOMWindow;
    readonly DOMWindowID: number;
    readonly isTopLevel: boolean;
    readonly isLoadingDocument: boolean;
    readonly loadType: number;

    addProgressListener(
        aListener: nsIWebProgressListener,
        aNotifyMask?: number,
    ): void;
    removeProgressListener(
        aListener: nsIWebProgressListener,
    ): void;
  }

  export interface nsIWebProgressListener extends nsISupports {
    onStateChange?: (
        aWebProgress: nsIWebProgress,
        aRequest: nsIRequest,
        aStateFlags: number,
        aStatus: nsresult,
    ) => void;

    onProgressChange?: (
        aWebProgress: nsIWebProgress,
        aRequest: nsIRequest,
        aCurSelfProgress: number,
        aMaxSelfProgress: number,
        aCurTotalProgress: number,
        aMaxTotalProgress: number,
    ) => void;

    onLocationChange?: (
        aWebProgress: nsIWebProgress,
        aRequest: nsIRequest,
        aLocation: nsIURI,
        aFlags?: number,
    ) => void;

    onStatusChange?: (
        aWebProgress: nsIWebProgress,
        aRequest: nsIRequest,
        aStatus: nsresult,
        aMessage: wstring,
    ) => void;

    onSecurityChange?: (
        aWebProgress: nsIWebProgress,
        aRequest: nsIRequest,
        aState: number,
    ) => void;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpfe/appshell/nsIWindowMediator.idl
  export interface nsIWindowMediator extends nsISupports {
    addListener(aListener: nsIWindowMediatorListener_without_nsISupports): void;
    removeListener(aListener: nsIWindowMediatorListener_without_nsISupports): void;
    getEnumerator(aWindowType: wstring | null): nsISimpleEnumerator;
    getMostRecentWindow(aWindowType: wstring | null): nsIDOMWindow;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpfe/appshell/nsIWindowMediatorListener.idl
  export interface nsIWindowMediatorListener_without_nsISupports {
    onWindowTitleChange(
        window: nsIXULWindow,
        newTitle: wstring,
    ): void;

    onOpenWindow(window: nsIXULWindow): void;
    onCloseWindow(window: nsIXULWindow): void;
  }
  export type nsIWindowMediatorListener =
      nsIWindowMediatorListener_without_nsISupports & nsISupports;

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

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/xpfe/appshell/nsIXULWindow.idl
  export interface nsIXULWindow extends nsISupports {
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/dom/base/nsPIDOMWindow.h
  export interface nsPIDOMWindow extends nsIDOMWindow {}

  export interface nsXPCComponents {
    classes: nsXPCComponents_Classes;
    interfaces: nsXPCComponents_Interfaces;
    results: nsXPCComponents_Results;
    ID: <T extends nsIJSCID>(iid: string) => T;
  }

  export interface nsXPCComponents_Classes {
    "@mozilla.org/appshell/appShellService;1": XPCOM.nsIJSCID;
    "@mozilla.org/categorymanager;1": XPCOM.nsIJSCID;
    "@mozilla.org/content/style-sheet-service;1": XPCOM.nsIJSCID;
    "@mozilla.org/embedcomp/prompt-service;1": XPCOM.nsIJSCID;
    "@mozilla.org/globalmessagemanager;1": XPCOM.nsIJSCID;
    "@mozilla.org/intl/converter-input-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/intl/converter-output-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/network/file-input-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/network/file-output-stream;1": XPCOM.nsIJSCID;
    "@mozilla.org/network/idn-service;1": XPCOM.nsIJSCID;
    "@mozilla.org/supports-string;1": XPCOM.nsIJSCID;
    "@mozilla.org/xmlextras/xmlhttprequest;1": XPCOM.nsIJSCID;
    "@mozilla.org/xre/app-info;1": XPCOM.nsIJSCID;
  }

  export interface nsXPCComponents_Interfaces {
    nsIAboutModule: XPCOM.nsIJSID & {
      ALLOW_SCRIPT: 1;
    };
    nsICategoryManager: XPCOM.nsIJSID;
    nsIChannel: XPCOM.nsIJSID & {
      LOAD_INITIAL_DOCUMENT_URI: number;
    };
    nsIChannelEventSink: XPCOM.nsIJSID;
    nsIComponentRegistrar: XPCOM.nsIJSID;
    nsIContentPolicy: XPCOM.nsIJSID & {
      ACCEPT: number,
      REJECT_SERVER: number,
      TYPE_DOCUMENT: number,
      TYPE_DTD: number,
      TYPE_OTHER: number,
    };
    nsIConverterInputStream: XPCOM.nsIJSID;
    nsIConverterOutputStream: XPCOM.nsIJSID;
    nsIDocShell: XPCOM.nsIJSID;
    nsIDocShellTreeItem: XPCOM.nsIJSID;
    nsIDOMDocument: XPCOM.nsIJSID;
    nsIDOMHTMLElement: XPCOM.nsIJSID;
    nsIDOMNode: XPCOM.nsIJSID & {
      DOCUMENT_NODE: number,
    };
    nsIDOMWindow: XPCOM.nsIJSID;
    nsIDOMWindowUtils: XPCOM.nsIJSID;
    nsIDOMXULElement: XPCOM.nsIJSID;
    nsIEventTarget: XPCOM.nsIJSID & {
      DISPATCH_NORMAL: 0;
    };
    nsIFactory: XPCOM.nsIJSID;
    nsIFile: XPCOM.nsIJSID;
    nsIFileInputStream: XPCOM.nsIJSID;
    nsIFileOutputStream: XPCOM.nsIJSID;
    nsIFileProtocolHandler: XPCOM.nsIJSID;
    nsIHttpChannel: XPCOM.nsIJSID;
    nsIIDNService: XPCOM.nsIJSID;
    nsIInterfaceRequestor: XPCOM.nsIJSID;
    nsILineInputStream: XPCOM.nsIJSID;
    nsILoadContext: XPCOM.nsIJSID;
    nsIMessageListenerManager: XPCOM.nsIJSID;
    nsIObserver: XPCOM.nsIJSID;
    nsIPrefBranch2: XPCOM.nsIJSID;
    nsIPromptService: XPCOM.nsIJSID;
    nsISHistoryListener: XPCOM.nsIJSID;
    nsIStyleSheetService: XPCOM.nsIJSID;
    nsISupports: XPCOM.nsIJSID;
    nsISupportsString: XPCOM.nsIJSID;
    nsISupportsWeakReference: XPCOM.nsIJSID;
    nsIURI: XPCOM.nsIJSID;
    nsIWeakReference: XPCOM.nsIJSID;
    nsIWebNavigation: XPCOM.nsIJSID;
    nsIXMLHttpRequest: XPCOM.nsIJSID;
    nsIXULAppInfo: XPCOM.nsIJSID;
  }

  export interface nsXPCComponents_Manager extends nsIComponentManager {
  }

  export interface nsXPCComponents_Results {
    NS_ERROR_FACTORY_EXISTS: nsresult;
    NS_ERROR_FAILURE: nsresult;
    NS_ERROR_NO_AGGREGATION: nsresult;
    NS_ERROR_NO_INTERFACE: nsresult;
    NS_NOINTERFACE: nsresult;
    NS_OK: nsresult;
  }

  export interface nsXPCComponents_Utils {
    import<T = any>(aResourceURI: string, targetObj?: any): T;
  }

  // https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Multiprocess_Firefox/Message_Manager/Message_manager_overview
  export type GlobalFrameMessageManager = nsIFrameScriptLoader & nsIMessageListenerManager & nsIMessageBroadcaster;
}

export namespace JSMs {
  type AddonCallback = (addon: Addon) => void;
  type AddonListCallback = (addons: Addon[]) => void;
  type InstallCallback = (install: AddonInstall) => void;
  type InstallListCallback = (installs: AddonInstall[]) => void;
  interface Addon {}
  interface AddonInstall {}
  interface AddonListener {}
  interface InstallListener {}
  interface TypeListener {}
  export interface AddonManager {
    getAllInstalls(callback: InstallListCallback): void;
    getInstallsByTypes(types: string[], callback: InstallListCallback): void;
    installAddonsFromWebpage(mimetype: string, source: XPCOM.nsIDOMWindow, uri: XPCOM.nsIURI, installs: AddonInstall[]): void;
    addInstallListener(listener: InstallListener): void;
    removeInstallListener(listener: InstallListener): void;
    getAllAddons(callback: AddonListCallback): void;
    getAddonByID(id: string, callback: AddonCallback): void;
    getAddonBySyncGUID(id: string, callback: AddonCallback): void;
    getAddonsByIDs(ids: string[], callback: AddonListCallback): void;
    getAddonsByTypes(types: string[], callback: AddonListCallback): void;
    getAddonsWithOperationsByTypes(types: string[], callback: AddonListCallback): void;
    addAddonListener(listener: AddonListener): void;
    removeAddonListener(listener: AddonListener): void;
    addTypeListener(listener: TypeListener): void;
    removeTypeListener(listener: TypeListener): void;
    getURIForResourceInFile(aFile: XPCOM.nsIFile, aPath: string): XPCOM.nsIURI;
  }

  // https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/CustomizableUI.jsm
  type WidgetGroupWrapper = any;
  export interface CustomizableUI {
    AREA_NAVBAR: "nav-bar";
    createWidget(aWidgetSpecification: any): WidgetGroupWrapper;
    destroyWidget(aWidgetId: any): void;
  }

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
            status: XPCOM.nsresult,
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

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/toolkit/modules/PrivateBrowsingUtils.jsm
  export interface PrivateBrowsingUtils {
    isWindowPrivate(aWindow: XPCOM.nsIDOMWindow): boolean;
  }

  export interface Services {
    appinfo: XPCOM.nsIXULAppInfo & XPCOM.nsIXULRuntime;
    dirsvc: XPCOM.nsIDirectoryService & XPCOM.nsIProperties;
    eTLD: XPCOM.nsIEffectiveTLDService;
    io: XPCOM.nsIIOService2;
    locale: XPCOM.nsILocaleService;
    obs: XPCOM.nsIObserverService;
    prefs: XPCOM.nsIPrefService & XPCOM.nsIPrefBranch & XPCOM.nsIPrefBranch2;
    scriptloader: XPCOM.mozIJSSubScriptLoader;
    scriptSecurityManager: XPCOM.nsIScriptSecurityManager;
    tm: XPCOM.nsIThreadManager;
    vc: XPCOM.nsIVersionComparator;
    wm: XPCOM.nsIWindowMediator;
  }

  export interface XPCOMUtils {
    generateQI(interfaces: XPCOM.nsIJSID[]): XPCOM.nsISupports["QueryInterface"];
  }
}

export namespace XUL {
  export type chromeDocument = XPCOM.nsIDOMDocument & Document & {
  }

  export type contentDocument = XPCOM.nsIDOMDocument & Document & {
    readonly defaultView: contentWindow;
  }

  export type chromeWindow = XPCOM.nsIDOMWindow & Window & utilityOverlay & {
    document: chromeDocument;
    gBrowser: tabBrowser | null;  // bug 1009938 - may be null in SeaMonkey
    gContextMenu: nsContextMenu;
    gContextMenuContentData: any;
    getBrowser(): tabBrowser;
    messageManager:
        XPCOM.nsIFrameScriptLoader &
        XPCOM.nsIMessageListenerManager &
        XPCOM.nsIMessageBroadcaster;
  }

  export type contentWindow = XPCOM.nsIDOMWindow & Window & {
    readonly top: XUL.contentWindow;
    readonly document: contentDocument;
    addEventListener: Window["addEventListener"];
    removeEventListener: Window["removeEventListener"];
  };

  export type contentNode = XPCOM.nsIDOMNode & Node & {
    ownerDocument: contentDocument;
  }

  export interface notification extends Element {
    accessibleType: number;
    image: string,
    label: string,
    priority: number,
    persistence: number,
    type: string;
    value: string;
  }

  export interface notificationbox {
    readonly PRIORITY_INFO_LOW: number;
    readonly PRIORITY_INFO_MEDIUM: number;
    readonly PRIORITY_INFO_HIGH: number;
    readonly PRIORITY_WARNING_LOW: number;
    readonly PRIORITY_WARNING_MEDIUM: number;
    readonly PRIORITY_WARNING_HIGH: number;
    readonly PRIORITY_CRITICAL_LOW: number;
    readonly PRIORITY_CRITICAL_MEDIUM: number;
    readonly PRIORITY_CRITICAL_HIGH: number;
    readonly PRIORITY_CRITICAL_BLOCK: number;

    currentNotification: any;
    allNotifications: any;
    notificationsHidden: any;

    appendNotification(
        label: string,
        value: string,
        image: string,
        priority: number,
        buttons: any,
        eventCallback?: () => void,
    ): notification;
    getNotificationWithValue(value: string): notification | null;
    removeTransientNotifications(): void;
  }

  interface nsContextMenu {
    target: Node;
    linkURL: string;
  }

  type popupPosition =
      "before_start" | "before_end" | "after_start" | "after_end" |
      "start_before" | "start_after" | "end_before" | "end_after" |
      "overlap" | "after_pointer";

  // <menupopup>
  export type menupopup = Element & XPCOM.nsIDOMXULElement & {
    accessibleType: number;
    anchorNode: XPCOM.nsIDOMElement;
    position: popupPosition;
    state: "closed" | "open" | "showing" | "hiding";
    triggerNode: XPCOM.nsIDOMNode;

    hidePopup(): void;
    openPopup(
        anchor: Node | null,
        position: popupPosition,
        x: number,
        y?: number,
        isContextMenu?: boolean,
        attributesOverride?: boolean,
        triggerEvent?: Event,
    ): void;
  }

  // <tabbrowser>
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/tabbrowser
  export interface tabBrowser extends XPCOM.nsIDOMXULElement, XPCOM.nsIWebProgress {
    currentURI: XPCOM.nsIURI;
    selectedBrowser: XUL.browser;
    selectedTab: XUL.tab;
    tabContainer: tabContainer;
    webNavigation: XPCOM.nsIWebNavigation;
    tabs: NodeList,

    addTab(
        URL: string,
        params?: {
          referrerURI: string,
          charset: any,
          postData: any,
          owner: any,
          allowThirdPartyFixup: any,
          relatedToCurrent: any,
        }
    ): XUL.tab;
    getBrowserAtIndex(index: number): XUL.browser;
    getNotificationBox(browser: XUL.browser): notificationbox;
  }

  // <tabs>
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/tabs
  export interface tabContainer extends XPCOM.nsIDOMXULElement {
    readonly childNodes: tab[];
    readonly children: tab[];
    selectedIndex: number;
  }

  // <tab>
  export interface tab extends XPCOM.nsIDOMXULElement {
    readonly linkedBrowser: browser;
  }

  interface OpenUILinkInParams {
    allowThirdPartyFixup?: boolean;
    postData?: XPCOM.nsIInputStream;
    referrerURI?: XPCOM.nsIURI;
    relatedToCurrent?: boolean;
    inBackground?: boolean;
    skipTabAnimation?: boolean;
    allowPinnedTabHostChange?: boolean;
    allowPopups?: boolean;
    userContextId?: number;
  }

  // https://dxr.mozilla.org/comm-esr45/source/mozilla/browser/base/content/utilityOverlay.js
  export interface utilityOverlay {
    openUILinkIn(
        url: string,
        where: "current" | "tab" | "tabshifted" | "window" | "save",
        aAllowThirdPartyFixup?: boolean | OpenUILinkInParams,
        aPostData?: XPCOM.nsIInputStream,
        aReferrerURI?: XPCOM.nsIURI,
    ): void;
  }

  // <browser>
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/browser
  export interface browser extends XPCOM.nsIDOMXULElement {
    readonly contentWindow: contentWindow;
    currentURI: XPCOM.nsIURI;
    messageManager: XPCOM.nsIProcessChecker & XPCOM.nsIFrameScriptLoader & XPCOM.nsIMessageListenerManager & XPCOM.nsIMessageSender
    readonly ownerGlobal: chromeWindow;
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
import { RuntimeApi } from "./runtime-api";
import { ChromeFileService } from "./services/chrome-file-service";
import { FileService } from "./services/file-service";
import { XPConnectService } from "./services/xpconnect-service";
import { XulService } from "./services/xul-service";
import { JsonStorage } from "./storage/json-storage";
import {
  PrefBranch,
  PrefType,
} from "./storage/pref-branch";
import { PrefObserver } from "./storage/pref-observer";
import { Storage } from "./storage/storage.module";
import { SyncLocalStorageArea } from "./storage/sync-local-storage-area";

import * as TryCatchUtils from "lib/utils/try-catch-utils";
import { KeyboardShortcutModule } from "app/windows/window/keyboard-shortcut-module";
import { KeyboardShortcuts } from "app/windows/window/keyboard-shortcuts";

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
    export type IRuntime = RuntimeApi;
  }

  export namespace services {
    export type IChromeFileService = ChromeFileService;
    export type IFileService = FileService;
    export type IXulService = XulService;
  }

  export namespace storage {
    export type IStorage = Storage;
    export type IPrefObserver = PrefObserver;
    export type IJsonStorage = JsonStorage;
    export type IPrefBranch = PrefBranch;
    export type ISyncLocalStorageArea = SyncLocalStorageArea;

    export type PrefBranchFactory = (
        branchRoot: string,
        namesToTypesMap: {[key: string]: PrefType},
    ) => IPrefBranch;
    export type PrefObserverFactory = () => PrefObserver;
  }

  export namespace windows {
    export namespace window {
      export type IKeyboardShortcuts = KeyboardShortcuts;
      export type IKeyboardShortcutModule = KeyboardShortcutModule;
      export type KeyboardShortcutFactory = (
          id: string,
          defaultCombo: string,
          callback: () => void,
          userEnabledPrefName: string,
          userComboPrefName: string,
      ) => IKeyboardShortcutModule;
    }
  }

  export type IManifest = Manifest;
  export type IMiscInfos = MiscInfos;
  export type IXPConnectService = XPConnectService;
  export interface ITryCatchUtils {
    getAppLocale: typeof TryCatchUtils.getAppLocale;
  }

  export type IApi = Api;
  export type ILegacyApi = Api["legacyApi"];
}
