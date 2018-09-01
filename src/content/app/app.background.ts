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

// @if EXTENSION_TYPE='legacy'
import { API, JSMs, XPCOM, XUL } from "bootstrap/api/interfaces";
import {JSMService} from "bootstrap/api/services/jsm-service";
import {
  StorageMigrationToWebExtension,
} from "legacy/app/migration/storage-migration-to-we";
import {V0RulesMigration} from "legacy/app/migration/v0-rules-migration";
declare const LegacyApi: API.ILegacyApi;
declare const Cc: XPCOM.nsXPCComponents_Classes;
declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Cr: XPCOM.nsXPCComponents_Results;
declare const Cu: XPCOM.nsXPCComponents_Utils;
declare const ComponentsID: XPCOM.nsXPCComponents["ID"];
declare const XPCOMUtils: JSMs.XPCOMUtils;

interface IEmbeddedWebExtension { browser: typeof browser; }
declare const _pEmbeddedWebExtension: Promise<IEmbeddedWebExtension>;
// @endif

import { FramescriptServices } from "app/framescripts/framescript-services";
import { Framescripts } from "app/framescripts/framescripts.module";
import { App } from "app/interfaces";
import { AboutUri } from "app/runtime/about-uri";
import { OtherRPInstallations } from "app/runtime/other-rp-installations";
import { HttpChannelService } from "app/services/http-channel-service";
import { PrivateBrowsingService } from "app/services/private-browsing-service";
import { RedirectionService } from "app/services/redirection-service";
import { RequestSetService } from "app/services/request-set-service";
import { MetadataMemory } from "app/web-request/metadata-memory";
import { ChromeStyleSheets } from "app/windows/stylesheets";
import { AustralisToolbarButton } from "app/windows/toolbarbutton.australis";
import { WindowModuleMap } from "app/windows/window-module-map";
import { ClassicMenu } from "app/windows/window/classicmenu";
import {
  KeyboardShortcutModule,
} from "app/windows/window/keyboard-shortcut-module";
import { KeyboardShortcuts } from "app/windows/window/keyboard-shortcuts";
import { Menu } from "app/windows/window/menu";
import { Overlay } from "app/windows/window/overlay";
import {
  NonAustralisToolbarButton,
} from "app/windows/window/toolbarbutton.non-australis";
import { WindowModule } from "app/windows/window/window.module";
import { XulTrees } from "app/windows/window/xul-trees";
import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { C } from "data/constants";
import { Connection } from "lib/classes/connection";
import { EventListenerModule } from "lib/classes/event-listener-module";
import { HttpChannelWrapper } from "lib/classes/http-channel-wrapper";
import { MessageListenerModule } from "lib/classes/message-listener-module";
import { NormalRequest, RedirectRequest } from "lib/classes/request";
import * as compareVersions from "lib/third-party/mozilla-version-comparator";
import { getPortFromSlaveConnectable } from "lib/utils/connection-utils";
import * as tryCatchUtils from "lib/utils/try-catch-utils";
import { getDOMWindowUtils } from "lib/utils/window-utils";
import { AppBackground } from "./app.background.module";
import { BrowserSettings } from "./browser-settings/browser-settings.module";
import { dAsyncSettings, log } from "./log";
import { Migration } from "./migration/migration.module";
import { SettingsMigration } from "./migration/storage/settings-migration";
import {
  StorageMigration,
} from "./migration/storage/storage-migration.module";
import { Policy } from "./policy/policy.module";
import { RulesetStorage } from "./policy/ruleset-storage";
import { Subscriptions } from "./policy/subscriptions";
import { Runtime } from "./runtime/runtime.module";
import { RequestService } from "./services/request-service";
import { RulesServices } from "./services/rules/rules-services.module";
import { V0RulesService } from "./services/rules/v0-rules-service";
import { RPServices } from "./services/services.module";
import { UriService } from "./services/uri-service";
import { VersionInfoService } from "./services/version-info-service";
import { WindowService } from "./services/window-service";
import { AsyncSettings } from "./storage/async-settings";
import { CachedSettings } from "./storage/cached-settings";
import { SETTING_SPECS } from "./storage/setting-specs";
import { StorageApiWrapper } from "./storage/storage-api-wrapper";
import {
  StorageAvailabilityController,
} from "./storage/storage-availability-controller";
import { Storage } from "./storage/storage.module";
import { InitialSetup } from "./ui/initial-setup";
import { Notifications } from "./ui/notifications/notifications.module";
import { Ui } from "./ui/ui.module";
import { RPChannelEventSink } from "./web-request/channel-event-sink";
import { RPContentPolicy } from "./web-request/content-policy";
import { RequestMemory } from "./web-request/request-memory";
import {RequestProcessor} from "./web-request/request-processor";
import { WebRequest } from "./web-request/web-request.module";
import {
  RedirectionNotifications,
} from "./windows/window/redirection-notifications";
import { Windows } from "./windows/windows.module";

const outerWindowID: number | null = null; // contentscripts only

//
// NOTES ABOUT BUILD-SPECIFIC (or optional) MODULES:
//
// 1. All optional modules should be defined as `const` using ternary operator.
// 2. All optional modules should fall back to `null` if unused or not
//    applicable. Do **not** use `undefined`.
//
// Rule 1+2 combined will ensure that nobody forgets to pass an optional
// module to the constructor of another module. (Optional constructor
// parameters are `undefined` and can be forgotten, `null` cannot.)
//

const {pEWEConnection, pWebextStorageMigration}: {
  pWebextStorageMigration:
      Promise<StorageMigrationToWebExtension | null>,
  pEWEConnection: Promise<Connection<any, any> | null>,
} = (
  C.EXTENSION_TYPE === "legacy" &&
  LegacyApi.miscInfos.isFirefox
) ? (() => {
  // @if EXTENSION_TYPE='legacy'
  const getEWEModules = (ewe: IEmbeddedWebExtension) => {
    const eweBrowser = ewe.browser;
    const promiseEwePort = () => {
      const portGetterLog = log.extend({name: "app.getPortFromConnectable"});
      return getPortFromSlaveConnectable(
          portGetterLog,
          portGetterLog,
          eweBrowser.runtime,
      );
    };
    const rvEWEConnection = new Connection(
        C.EWE_CONNECTION_LEGACY_ID,
        log,
        C.EWE_CONNECTION_EWE_ID,
        promiseEwePort,
    );
    const rvWebextStorageMigration = new StorageMigrationToWebExtension(
        log,
        browser.storage,  // badword-linter:allow:browser.storage:
        rvEWEConnection.whenReady.then(() => rvEWEConnection),
    );
    return {
      eweConnection: rvEWEConnection,
      webextStorageMigration: rvWebextStorageMigration,
    };
  };

  const pModules = _pEmbeddedWebExtension.then(
      getEWEModules,
      () => ({
        eweConnection: null,
        webextStorageMigration: null,
      }),
  );
  return {
    pEWEConnection: pModules.then(({eweConnection}) => eweConnection),
    pWebextStorageMigration: pModules.
        then(({webextStorageMigration}) => webextStorageMigration),
  };
  // @endif
})() : {
  pEWEConnection: Promise.resolve(null),
  pWebextStorageMigration: Promise.resolve(null),
};

const settingsMigration = new SettingsMigration(
    log,
    browser.storage.local,  // badword-linter:allow:browser.storage:
    pWebextStorageMigration,
);

// helper fn
function whenLegacy<T>(gen: () => T): T | null {
  return C.EXTENSION_TYPE === "legacy" ? gen() : null;
}
// helper classes
const jsmService = whenLegacy(() => new JSMService(Cu));
const xpconnectService = whenLegacy(() => new XPConnectService());
// JSMs
const mozPrivateBrowsingUtils = whenLegacy(() =>
    jsmService!.getPrivateBrowsingUtils());
const mozServices = whenLegacy(() => jsmService!.getServices());
// Services from Services.jsm
const mozEffectiveTLDService = whenLegacy(() => mozServices!.eTLD);
const mozIOService = whenLegacy(() => mozServices!.io);
const mozObserverService = whenLegacy(() => mozServices!.obs);
const mozVersionComparator = whenLegacy(() => mozServices!.vc);
const mozWindowMediator = whenLegacy(() => mozServices!.wm);
// Services via Cc["..."].getService(Ci.foo) and similar
const mozCategoryManager = whenLegacy(() =>
    xpconnectService!.getCategoryManager());
const mozComponentRegistrar = whenLegacy(() =>
    xpconnectService!.getComponentRegistrar());
const mozGlobalFrameMessageManager =
    whenLegacy(() => xpconnectService!.getGlobalFrameMessageManager());
const mozIDNService = whenLegacy(() => xpconnectService!.getIDNService());
const mozPromptService = whenLegacy(() => xpconnectService!.getPromptService());
const mozStyleSheetService = whenLegacy(() =>
    xpconnectService!.getStyleSheetService());

const xpcApi = C.EXTENSION_TYPE === "legacy" ? {
  prefsService: mozServices!.prefs,
  rpPrefBranch: LegacyApi.rpPrefBranch,
  tryCatchUtils: LegacyApi.tryCatchUtils,
} : null;

const storageAvailabilityController = new StorageAvailabilityController(
    log,
    outerWindowID,
    settingsMigration,
    pWebextStorageMigration,
);
const storageApiWrapper = new StorageApiWrapper(
    outerWindowID,
    log,
    browser.storage,  // badword-linter:allow:browser.storage:
    storageAvailabilityController,
);
const uriService = new UriService(
    log,
    outerWindowID,
    mozEffectiveTLDService!,  // fixme
    mozIDNService!,  // fixme
    mozIOService!,  // fixme
);
const rulesetStorage = new RulesetStorage(log, storageApiWrapper, uriService);
const subscriptions = new Subscriptions(
    log,
    storageApiWrapper,
    rulesetStorage,
    uriService,
);
const policy = new Policy(log, rulesetStorage, subscriptions, uriService);
const aboutUri = new AboutUri(
    log,
    mozCategoryManager!,  // fixme
    mozComponentRegistrar!,  // fixme
    Ci,
    Cr,
    ComponentsID,
    XPCOMUtils,
    LegacyApi.miscInfos,
    mozIOService!,  // fixme
);
const runtime = new Runtime(log, pEWEConnection, aboutUri, browser.runtime);

const asyncSettings = new AsyncSettings(
    log,
    outerWindowID,
    storageApiWrapper,
    SETTING_SPECS.defaultValues,
);
dAsyncSettings.resolve(asyncSettings);
const cachedSettings = new CachedSettings(
    log,
    SETTING_SPECS,
    storageApiWrapper,
    LegacyApi.rpPrefBranch, /* FIXME */
);
const storage = new Storage(
    log,
    outerWindowID,
    storageApiWrapper,
    asyncSettings,
    cachedSettings,
    storageAvailabilityController,
);

const browserSettings = new BrowserSettings(
    log, cachedSettings,
    (browser as any).privacy.network,
);

const windowModuleMap = new WindowModuleMap(log);

const requestSetService = new RequestSetService(log, uriService);
const requestMemory = new RequestMemory(log, requestSetService, uriService);
const framescriptServices = new FramescriptServices(
    log, browser.
    runtime,
    requestMemory,
    uriService,
    cachedSettings,
);
const framescripts = new Framescripts(
    log,
    framescriptServices,
    mozGlobalFrameMessageManager!,
);

const httpChannelService = new HttpChannelService(
    log,
    mozServices!.io,
    tryCatchUtils,
);
const privateBrowsingService = new PrivateBrowsingService(
    log,
    mozPrivateBrowsingUtils!,  // fixme
    cachedSettings,
);
const requestService = new RequestService(
    log,
    cachedSettings,
    httpChannelService,
    uriService,
);
const redirectionService = new RedirectionService(
    log,
    Ci,
    requestService,
    windowModuleMap,
);
const v0RulesService = new V0RulesService(
    log,
    uriService,
    xpcApi,
);
const rulesServices = new RulesServices(log, v0RulesService);
const versionComparator = { compare: compareVersions };
const versionInfoService = new VersionInfoService(
    log, versionComparator, cachedSettings,
    browser.management,
    browser.runtime,
);
const windowService = new WindowService(
    log,
    Ci,
    mozWindowMediator!,
    uriService,
);
const rpServices = new RPServices(
    log,
    httpChannelService,
    privateBrowsingService,
    redirectionService,
    requestService,
    requestSetService,
    rulesServices,
    uriService,
    versionInfoService,
    windowService,
);

const v0RulesMigration = C.EXTENSION_TYPE === "legacy" ?
    new V0RulesMigration(
        log, policy, v0RulesService, versionInfoService,
    ) : null;
const storageMigration = new StorageMigration(
    log,
    settingsMigration,
    v0RulesMigration,
    pWebextStorageMigration,
);

const migration = new Migration(log, storageMigration);

const notifications = new Notifications(
    log,
    windowService,
);
const initialSetup = new InitialSetup(
    log,
    cachedSettings,
    versionInfoService,
    notifications,
    xpcApi!,  // FIXME
);
const otherRPInstallations = new OtherRPInstallations(log, notifications);
const ui = new Ui(log, initialSetup, otherRPInstallations, notifications);

const metadataMemory = new MetadataMemory(log);
const requestProcessor = new RequestProcessor(
    log,
    Ci,
    Cr,
    mozObserverService,
    cachedSettings,
    httpChannelService,
    metadataMemory,
    redirectionService,
    requestMemory,
    requestService,
    policy,
    uriService,
    windowModuleMap,
);
const redirectRequestFactory = (
    aOldChannel: HttpChannelWrapper,
    aNewChannel: HttpChannelWrapper,
    aFlags: number,
) => new RedirectRequest(
    aOldChannel, aNewChannel, aFlags,
    httpChannelService.getUri(aOldChannel),
    httpChannelService.getUri(aNewChannel),
);
const normalRequestFactory = (
    aContentType: any,
    aContentLocation: any,
    aRequestOrigin: any,
    aContext: any,
    aMimeTypeGuess: any,
    aExtra: any,
    aRequestPrincipal: any,
) => new NormalRequest(
    aContentType, aContentLocation, aRequestOrigin,
    aContext, aMimeTypeGuess, aExtra, aRequestPrincipal,
);
const rpChannelEventSink = new RPChannelEventSink(
    log,
    mozCategoryManager!,  // fixme
    mozComponentRegistrar!,  // fixme
    Ci,
    Cr,
    ComponentsID,
    XPCOMUtils,
    requestProcessor,
    redirectRequestFactory,
);
const rpContentPolicy = new RPContentPolicy(
    log,
    mozCategoryManager!,  // fixme
    mozComponentRegistrar!,  // fixme
    Ci, Cr, ComponentsID, XPCOMUtils,
    requestProcessor, normalRequestFactory,
);
const rpWebRequest = new WebRequest(
    log,
    metadataMemory,
    requestMemory,
    requestProcessor,
    rpChannelEventSink,
    rpContentPolicy,
);

const windowModuleFactory: App.windows.WindowModuleFactory = (
    window: XUL.chromeWindow,
) => {
  const windowID = getDOMWindowUtils(window).outerWindowID;
  const moduleNamePrefix = `app.chromeWindow[${windowID}]`;
  const classicMenu = new ClassicMenu(
      log,
      windowID,
      window,
      policy,
  );
  const overlayWrapper: {
    module: App.windows.window.IOverlay | null;
  } = {
    module: null,
  };
  const menu = new Menu(
      log,
      windowID,
      window,
      mozPromptService!,  // fixme
      browser.i18n,
      cachedSettings,
      policy,
      privateBrowsingService,
      requestMemory,
      uriService,
      windowService,
  );
  const xulTrees = new XulTrees(
      log,
      windowID,
      window,
      LegacyApi.xulService,
      classicMenu,
      menu,
      overlayWrapper,
  );

  const eventListener = new EventListenerModule(moduleNamePrefix, log);
  const msgListener = new MessageListenerModule(
      moduleNamePrefix,
      log,
      window.messageManager,
  );

  const redirectionNotifications = new RedirectionNotifications(
      log,
      windowID,
      window,
      browser.i18n,
      classicMenu,
      menu,
      cachedSettings,
      privateBrowsingService,
      requestProcessor,
      runtime,
      uriService,
      windowService,
  );
  const overlay = new Overlay(
      log,
      windowID,
      window,
      Cc,
      Ci,
      Cr,
      storageApiWrapper,
      menu,
      msgListener,
      redirectionNotifications,
      cachedSettings,
      eventListener,
      policy,
      requestMemory,
      requestProcessor,
      runtime,
      uriService,
      windowService,
  );
  overlayWrapper.module = overlay;
  const keyboardShortcutFactory: API.windows.window.KeyboardShortcutFactory = (
      id: string,
      defaultCombo: string,
      callback: () => void,
      userEnabledPrefName: string,
      userComboPrefName: string,
  ) => new KeyboardShortcutModule(
      log,
      windowID,
      window,
      LegacyApi.createPrefObserver,
      cachedSettings,
      xulTrees,
      id,
      defaultCombo,
      callback,
      userEnabledPrefName,
      userComboPrefName,
  );
  const keyboardShortcuts = new KeyboardShortcuts(
      log,
      windowID,
      overlay,
      keyboardShortcutFactory,
  );
  const nonAustralisToolbarButton = new NonAustralisToolbarButton(
      log,
      windowID,
      window,
      mozVersionComparator!,  // fixme
      LegacyApi.miscInfos,
      LegacyApi.xulService,
      xulTrees,
  );
  return new WindowModule(
      log,
      windowID,
      window,
      eventListener,
      classicMenu,
      keyboardShortcuts,
      menu,
      msgListener,
      overlay,
      redirectionNotifications,
      nonAustralisToolbarButton,
      xulTrees,
      windowService,
  );
};
const chromeStyleSheets = new ChromeStyleSheets(
    log,
    mozStyleSheetService!,  // fixme
    LegacyApi.miscInfos,
    uriService,
);
const toolbarbuttonAustralis = ((): AustralisToolbarButton | null => {
  if (!LegacyApi.miscInfos.isAustralis) return null;
  const mozCustomizableUI = jsmService!.getCustomizableUI();
  return new AustralisToolbarButton(
      log,
      mozCustomizableUI,
      windowModuleMap,
  );
})();
const windows = new Windows(
    log,
    cachedSettings,
    windowModuleFactory,
    windowService,
    chromeStyleSheets,
    toolbarbuttonAustralis,
    windowModuleMap,
);

export const rp = new AppBackground(
    log,
    browserSettings,
    framescripts,
    migration,
    policy,
    runtime,
    rpServices,
    storage,
    ui,
    rpWebRequest,
    windows,
);
