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

import { BrowserSettings } from "./browser-settings/browser-settings.module";
import { ManagerForBlockedContent } from "./contentscript/blocked-content";
import { ContentscriptModule } from "./contentscript/contentscript.module";
import { ManagerForDOMContentLoaded } from "./contentscript/dom-content-loaded";
import { FramescriptToBackgroundCommunication } from "./contentscript/framescript-to-background-communication";
import { ContentscriptMisc } from "./contentscript/misc";
import { Migration } from "./migration/migration.module";
import { SettingsMigration } from "./migration/storage/settings-migration";
import { Policy } from "./policy/policy.module";
import { RPServices } from "./services/services.module";
import { CachedSettings } from "./storage/cached-settings";
import { Storage } from "./storage/storage.module";
import { Ui } from "./ui/ui.module";
import { HttpChannelService } from "./services/http-channel-service";
import { RequestService } from "./services/request-service";
import { RulesServices } from "./services/rules/rules-services.module";
import { UriService } from "./services/uri-service";
import { VersionInfoService } from "./services/version-info-service";
import { AsyncSettings } from "./storage/async-settings";
import { StorageMigration } from "./migration/storage/storage-migration.module";
import { RPChannelEventSink } from "./web-request/channel-event-sink";
import { RPContentPolicy } from "./web-request/content-policy";
import { RequestMemory } from "./web-request/request-memory";
import { RequestProcessor } from "./web-request/request-processor";
import { WebRequest } from "./web-request/web-request.module";
import { MetadataMemory } from "./web-request/metadata-memory";
import { XPCOM } from "bootstrap/api/interfaces";
import { V0RulesMigration } from "legacy/app/migration/v0-rules-migration";
import { StorageMigrationToWebExtension } from "legacy/app/migration/storage-migration-to-we";
import { MessageListenerModule } from "lib/classes/message-listener-module";
import * as compareVersions from "lib/third-party/mozilla-version-comparator";

export interface IVersionComparator {
  compare: typeof compareVersions;
}

export namespace App {
  export namespace contentSide {
    export type ICommunicationToBackground = FramescriptToBackgroundCommunication;
    export type IContentscriptMisc = ContentscriptMisc;
    export type IManagerForBlockedContent = ManagerForBlockedContent;
    export type IManagerForDOMContentLoaded = ManagerForDOMContentLoaded;

    export type ICSMessageListener = App.utils.IMessageListener<
        XPCOM.nsIContentFrameMessageManager
    >;
  }

  export namespace migration {
    export namespace storage {
      export type ISettingsMigration = SettingsMigration;
      export type IV0RulesMigration = V0RulesMigration;
      export type IStorageMigrationToWebExtension = StorageMigrationToWebExtension;
    }
    export type IStorageMigration = StorageMigration;
  }

  export namespace services {
    export type IHttpChannelService = HttpChannelService;
    export type IRequestService = RequestService;
    export type IRulesServices = RulesServices;
    export type IUriService = UriService;
    export type IVersionInfoService = VersionInfoService;
  }

  export namespace storage {
    export type IAsyncSettings = AsyncSettings;
    export type ICachedSettings = CachedSettings;
  }

  export namespace webRequest {
    export type IMetadataMemory = MetadataMemory;
    export type IRequestMemory = RequestMemory;
    export type IRPChannelEventSink = RPChannelEventSink;
    export type IRPContentPolicy = RPContentPolicy;
    export type IRequestProcessor = RequestProcessor;
  }

  export type IBrowserSettings = BrowserSettings;
  export type IContentSide = ContentscriptModule;
  export type IMigration = Migration;
  export type IPolicy = Policy;
  export type IRPServices = RPServices;
  export type IStorage = Storage;
  export type IUi = Ui;
  export type IWebRequest = WebRequest;

  export namespace utils {
    export type IMessageListener<T extends XPCOM.nsIMessageManager> = MessageListenerModule<T>;
  }
}
