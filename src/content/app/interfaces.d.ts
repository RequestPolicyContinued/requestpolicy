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

import { XPCOM, XUL } from "bootstrap/api/interfaces";
import { StorageMigrationToWebExtension } from "legacy/app/migration/storage-migration-to-we";
import { V0RulesMigration } from "legacy/app/migration/v0-rules-migration";
import { MessageListenerModule } from "lib/classes/message-listener-module";
import * as compareVersions from "lib/third-party/mozilla-version-comparator";
import * as WindowUtils from "lib/utils/window-utils";

import { BrowserSettings } from "./browser-settings/browser-settings.module";
import { ManagerForBlockedContent } from "./contentscript/blocked-content";
import { ContentscriptModule } from "./contentscript/contentscript.module";
import { ManagerForDOMContentLoaded } from "./contentscript/dom-content-loaded";
import { FramescriptToBackgroundCommunication } from "./contentscript/framescript-to-background-communication";
import { ContentscriptMisc } from "./contentscript/misc";
import { FramescriptServices } from "./framescripts/framescript-services";
import { Framescripts } from "./framescripts/framescripts.module";
import { Migration } from "./migration/migration.module";
import { SettingsMigration } from "./migration/storage/settings-migration";
import { StorageMigration } from "./migration/storage/storage-migration.module";
import { Policy } from "./policy/policy.module";
import { RulesetStorage } from "./policy/ruleset-storage";
import { Subscriptions } from "./policy/subscriptions";
import { HttpChannelService } from "./services/http-channel-service";
import { PrivateBrowsingService } from "./services/private-browsing-service";
import { RequestService } from "./services/request-service";
import { RequestSetService } from "./services/request-set-service";
import { RulesServices } from "./services/rules/rules-services.module";
import { RPServices } from "./services/services.module";
import { UriService } from "./services/uri-service";
import { VersionInfoService } from "./services/version-info-service";
import { WindowService } from "./services/window-service";
import { AsyncSettings } from "./storage/async-settings";
import { CachedSettings } from "./storage/cached-settings";
import { Storage } from "./storage/storage.module";
import { Notifications } from "./ui/notifications/notifications.module";
import { Ui } from "./ui/ui.module";
import { RPChannelEventSink } from "./web-request/channel-event-sink";
import { RPContentPolicy } from "./web-request/content-policy";
import { MetadataMemory } from "./web-request/metadata-memory";
import { RequestMemory } from "./web-request/request-memory";
import { RequestProcessor } from "./web-request/request-processor";
import { WebRequest } from "./web-request/web-request.module";
import { ChromeStyleSheets } from "./windows/stylesheets";
import { AustralisToolbarButton } from "./windows/toolbarbutton.australis";
import { ClassicMenu } from "./windows/window/classicmenu";
import { Menu } from "./windows/window/menu";
import { Overlay } from "./windows/window/overlay";
import { NonAustralisToolbarButton } from "./windows/window/toolbarbutton.non-australis";
import { WindowModule } from "./windows/window/window.module";
import { XulTrees } from "./windows/window/xul-trees";
import { Windows } from "./windows/windows.module";
import { AboutUri } from "app/runtime/about-uri";
import { EventListenerModule } from "lib/classes/event-listener-module";

export interface IVersionComparator {
  compare: typeof compareVersions;
}

export namespace App {
  export namespace contentSide {
    export type ICommunicationToBackground = FramescriptToBackgroundCommunication;
    export type IContentscriptMisc = ContentscriptMisc;
    export type IManagerForBlockedContent = ManagerForBlockedContent;
    export type IManagerForDOMContentLoaded = ManagerForDOMContentLoaded;

    export type IMessageListenerModule = MessageListenerModule<XPCOM.nsIContentFrameMessageManager>;
  }

  export namespace framescripts {
    export type IFramescriptServices = FramescriptServices;
  }

  export namespace migration {
    export namespace storage {
      export type ISettingsMigration = SettingsMigration;
      export type IV0RulesMigration = V0RulesMigration;
      export type IStorageMigrationToWebExtension = StorageMigrationToWebExtension;
    }
    export type IStorageMigration = StorageMigration;
  }

  export namespace policy {
    export type IRulesetStorage = RulesetStorage;
    export type ISubscriptions = Subscriptions;
  }

  export namespace services {
    export type IHttpChannelService = HttpChannelService;
    export type IPrivateBrowsingService = PrivateBrowsingService;
    export type IRequestService = RequestService;
    export type IRequestSetService = RequestSetService;
    export type IRulesServices = RulesServices;
    export type IUriService = UriService;
    export type IVersionInfoService = VersionInfoService;
    export type IWindowService = WindowService;
  }

  export namespace runtime {
    export type IAboutUri = AboutUri;
  }

  export namespace storage {
    export type IAsyncSettings = AsyncSettings;
    export type ICachedSettings = CachedSettings;
  }

  export namespace ui {
    export type INotifications = Notifications;
  }

  export namespace webRequest {
    export type IMetadataMemory = MetadataMemory;
    export type IRequestMemory = RequestMemory;
    export type IRPChannelEventSink = RPChannelEventSink;
    export type IRPContentPolicy = RPContentPolicy;
    export type IRequestProcessor = RequestProcessor;
  }

  export namespace windows {
    export namespace window {
      export type IClassicMenu = ClassicMenu;
      export type IMenu = Menu;
      export type IOverlay = Overlay;
      export type IToolbarButton = NonAustralisToolbarButton;
      export type IXulTrees = XulTrees;
      export type IMessageListenerModule = MessageListenerModule<XUL.chromeWindow["messageManager"]>;
    }

    export type IChromeStyleSheets = ChromeStyleSheets;
    export type IWindowModule = WindowModule;
    export type IToolbarButton = AustralisToolbarButton;
    export type WindowModuleFactory = (
        window: XPCOM.nsIDOMWindow,
    ) => WindowModule;
  }

  export type IBrowserSettings = BrowserSettings;
  export type IContentSide = ContentscriptModule;
  export type IFramescripts = Framescripts;
  export type IMigration = Migration;
  export type IPolicy = Policy;
  export type IRPServices = RPServices;
  export type IStorage = Storage;
  export type IUi = Ui;
  export type IWebRequest = WebRequest;
  export type IWindows = Windows;

  export namespace common {
    export type IEventListenerModule = EventListenerModule;
    export type IMessageListenerModule<T extends XPCOM.nsIMessageListenerManager> = MessageListenerModule<T>;
  }

  export namespace utils {
    export type IWindowUtils = typeof WindowUtils;
  }
}
