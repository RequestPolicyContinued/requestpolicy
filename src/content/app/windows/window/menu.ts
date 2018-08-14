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
import {log} from "app/log";
import { IRuleSpec, Ruleset } from "app/policy/ruleset";  // fixme
import { XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import {
  GUIDestination, GUILocation, GUILocationProperties, GUIOrigin,
} from "lib/classes/gui-location";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { RequestSet } from "lib/classes/request-set";
import { removeChildren } from "lib/utils/dom-utils";
import { getTabBrowser } from "lib/utils/window-utils";

type IList = HTMLDivElement;
interface IListItem extends HTMLDivElement {
  value: string;
  requestpolicyRuleData: IRuleSpec;
  requestpolicyRuleAction: RuleActionChange;
}

interface IRuleSpecObj {
  [canonicalRuleString: string]: IRuleSpec;
}

type RuleActionChange =
    "allow" |
    "allow-temp" |
    "stop-allow" |
    "deny" |
    "deny-temp" |
    "stop-deny";

const RULE_ACTION_CHANGES: RuleActionChange[] = [
  "allow",
  "allow-temp",
  "stop-allow",
  "deny",
  "deny-temp",
  "stop-deny",
];

export class Menu extends Module implements App.windows.window.IMenu {
  // protected get debugEnabled() { return true; }

  // TODO: Create a "List" class which also contains functions like
  //       _populateList() and emptyList().
  private lists: {
    addRules: IList | null,
    allowedDestinations: IList | null,
    blockedDestinations: IList | null,
    mixedDestinations: IList | null,
    otherOrigins: IList | null,
    removeRules: IList | null,
  } = {
    addRules: null,
    allowedDestinations: null,
    blockedDestinations: null,
    mixedDestinations: null,
    otherOrigins: null,
    removeRules: null,
  };

  private originItem: any = null;
  private originDomainnameItem: any = null;
  private isUncontrollableOrigin: any = null;
  private originNumRequestsItem: any = null;

  private isCurrentlySelectedDestBlocked: any = null;
  private isCurrentlySelectedDestAllowed: any = null;

  private ruleChangeQueues: {
    "allow": IRuleSpecObj;
    "allow-temp": IRuleSpecObj;
    "stop-allow": IRuleSpecObj;
    "deny": IRuleSpecObj;
    "deny-temp": IRuleSpecObj;
    "stop-deny": IRuleSpecObj;
  } = {
    "allow": {},
    "allow-temp": {},
    "deny": {},
    "deny-temp": {},
    "stop-allow": {},
    "stop-deny": {},
  };

  private currentBaseDomain: string | null;
  private currentlySelectedDest: string | null;
  private currentlySelectedOrigin: string;
  private currentUri: string;
  private currentUriObj: XPCOM.nsIURI;
  private isChromeUri: boolean;

  private allRequestsOnDocument: RequestSet;

  private get gBrowser() { return getTabBrowser(this.window)!; }

  protected get startupPreconditions() {
    return [
      this.privateBrowsingService.whenReady,
      this.uriService.whenReady,
      this.windowService.whenReady,
      this.policy.whenReady,
      this.cachedSettings.whenReady,
      this.requestMemory.whenReady,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      windowID: number,
      private window: XUL.chromeWindow,

      private readonly mozPromptService: XPCOM.nsIPromptService,

      private i18n: typeof browser.i18n,

      private readonly privateBrowsingService:
          App.services.IPrivateBrowsingService,
      private readonly uriService: App.services.IUriService,
      private readonly windowService: App.services.IWindowService,
      private readonly policy: App.IPolicy,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly requestMemory: App.webRequest.IRequestMemory,
  ) {
    super(`app.windows[${windowID}].menu`, parentLog);
  }

  public addWildcard(hostname: string) {
    if (this.isIPAddressOrSingleName(hostname)) {
      return hostname;
    } else {
      return `*.${hostname}`;
    }
  }

  public prepareMenu() {
    this.debugLog.log("preparing the menu");
    try {
      this.originItem = this.$id("rpc-origin");
      this.originDomainnameItem = this.$id("rpc-origin-domainname");
      this.originNumRequestsItem = this.$id("rpc-origin-num-requests");

      this.lists.otherOrigins =
          this.$id("rpc-other-origins-list") as HTMLDivElement;
      this.lists.blockedDestinations =
          this.$id("rpc-blocked-destinations-list") as HTMLDivElement;
      this.lists.mixedDestinations =
          this.$id("rpc-mixed-destinations-list") as HTMLDivElement;
      this.lists.allowedDestinations =
          this.$id("rpc-allowed-destinations-list") as HTMLDivElement;
      this.lists.addRules = this.$id("rpc-rules-add") as HTMLDivElement;
      this.lists.removeRules = this.$id("rpc-rules-remove") as HTMLDivElement;

      const disabled = this.cachedSettings.alias.isBlockingDisabled();
      this.$id("rpc-link-enable-blocking")!.hidden = !disabled;
      this.$id("rpc-link-disable-blocking")!.hidden = disabled;

      const tempPermLink = this.$id("rpc-revoke-temporary-permissions")!;
      if (this.policy.temporaryRulesExist()) {
        tempPermLink.className = "rpc-revoke-temporary-permissions-enable";
      } else {
        tempPermLink.className = "rpc-revoke-temporary-permissions-disable";
      }

      this.currentUri = this.windowService.getTopLevelDocumentUri(this.window);

      try {
        this.currentBaseDomain =
            this.uriService.getBaseDomain(this.currentUri);
        if (this.currentBaseDomain === null) {
          log.info(`${"Unable to prepare menu because " +
              "the current uri has no host: "}${this.currentUri}`);
          this.populateMenuForUncontrollableOrigin();
          return;
        }
      } catch (e) {
        log.info(`${"Unable to prepare menu because " +
            "base domain can't be determined: "}${this.currentUri}`);
        this.populateMenuForUncontrollableOrigin();
        return;
      }

      // log.info("this._currentUri: " + this._currentUri);
      this.currentUriObj = this.uriService.getUriObject(this.currentUri);

      this.isChromeUri = this.currentUriObj.scheme === "chrome";
      // this._currentUriIsHttps = this._currentUriObj.scheme === "https";

      log.info(`this._currentUri: ${this.currentUri}`);

      if (this.isChromeUri) {
        this.populateMenuForUncontrollableOrigin();
        return;
      }

      // The fact that getAllRequestsInBrowser uses currentURI.spec directly
      // from the browser is important because getTopLevelDocumentUri will
      // not return the real URI if there is an applicable
      // top-level document translation rule (these are used sometimes
      // for extension compatibility). For example, this is essential to the
      // menu showing relevant info when using the Update Scanner extension.
      this.allRequestsOnDocument = this.requestMemory.
          getAllRequestsInBrowser(this.gBrowser.selectedBrowser);
      this.allRequestsOnDocument.print(
          "_allRequestsOnDocument",
          log.log.bind(log),
      );

      this.setPrivateBrowsingStyles();

      this.populateOrigin();
      this.populateOtherOrigins();
      this.activateOriginItem(this.originItem);
    } catch (e) {
      console.error("[Fatal] Unable to prepare menu! Details:");
      console.dir(e);
      // eslint-disable-next-line no-throw-literal
      throw e;
    }
  }

  public close() {
    this.windowService.closeMenu(this.window);
  }

  public itemSelected(event: MouseEvent) {
    // We retrieve the element on which the listener was added to always
    // get the div (and not one span or textnode children)
    const item = event.currentTarget as IListItem;
    // TODO: rather than compare IDs, this should probably compare against
    // the elements we already have stored in variables. That is, assuming
    // equality comparisons work that way here.
    const itemParent = item.parentNode as IList;
    if (item.id === "rpc-origin" ||
        itemParent.id === "rpc-other-origins-list") {
      if (event.button === 1) {
        this.maybeOpenSiteInfoTab(item);
      } else {
        this.activateOriginItem(item);
      }
    } else if (itemParent.id === "rpc-blocked-destinations-list" ||
               itemParent.id === "rpc-mixed-destinations-list" ||
               itemParent.id === "rpc-allowed-destinations-list") {
      if (event.button === 1) {
        this.maybeOpenSiteInfoTab(item);
      } else {
        this.activateDestinationItem(item);
      }
    } else if (itemParent.id === "rpc-rules-remove" ||
               itemParent.id === "rpc-rules-add") {
      this.processRuleSelection(item);
    } else {
      console.error("Unable to figure out which item type was selected.");
    }
  }

  public processQueuedRuleChanges() {
    let rulesChanged = false;
    for (const ruleAction of RULE_ACTION_CHANGES) {
      // tslint:disable-next-line:forin
      for (const canonicalRule
           of Object.keys(this.ruleChangeQueues[ruleAction])) {
        const ruleData = this.ruleChangeQueues[ruleAction][canonicalRule];
        this.processRuleChange(ruleAction, ruleData);
        rulesChanged = true;
      }
      this.ruleChangeQueues[ruleAction] = {};
    }
    return rulesChanged;
  }

  // ---------------------------------------------------------------------------

  protected shutdownSelf() {
    // empty _all_ lists
    // tslint:disable-next-line:forin
    for (const listName in this.lists) {
      this.emptyList((this.lists as any)[listName]);
    }
    return MaybePromise.resolve(undefined);
  }

  // ---------------------------------------------------------------------------

  private $id(id: string) {
    return this.windowService.$id(this.window, id);
  }

  /**
   * Show a dialog with "OK" and "Cancel" buttons, as well as with a
   * checkbox labeled "always ask?".
   */
  private confirm(
      dialogMessage: string,
      alwaysAskPrefName: string,
      params: any = {},
  ): boolean {
    const shouldAsk = this.cachedSettings.get(alwaysAskPrefName);
    if (shouldAsk === false) {
      // never ask
      return true;
    }

    const dialogTitle = params.dialogTitle || "RequestPolicy";
    const checkboxObj = {value: shouldAsk};
    const checkboxText = browser.i18n.getMessage("alwaysAsk");

    if (typeof params.onBeforeDialog === "function") {
      params.onBeforeDialog.call();
    }

    const confirmed = this.mozPromptService.confirmCheck(
        this.window,
        dialogTitle,
        dialogMessage,
        checkboxText,
        checkboxObj,
    );

    if (confirmed) {
      // "OK" has been pressed
      this.cachedSettings.set({
        alwaysAskPrefName: checkboxObj.value,
      }).catch(this.log.onError(`set 'alwaysAskPrefName'`));
      return true;
    }
    // "Cancel" has been pressed
    return false;
  }

  /**
   * Remove all children from a list, and remove all event listeners.
   */
  private emptyList(aList: IList) {
    if (!aList) {
      return;
    }

    // remove all event listeners
    {
      const elements = aList.getElementsByClassName("listen-click");
      for (const el of Array.from(elements)) {
        el.removeEventListener("click", this.itemSelected, false);
      }
    }

    removeChildren(aList);
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------

  private populateMenuForUncontrollableOrigin() {
    this.originDomainnameItem.textContent =
        browser.i18n.getMessage("noOrigin");
    this.isUncontrollableOrigin = true;
    this.originNumRequestsItem.textContent = "";
    this.originItem.removeAttribute("default-policy");
    this.originItem.removeAttribute("requests-blocked");

    [
      this.lists.otherOrigins,
      this.lists.blockedDestinations,
      this.lists.mixedDestinations,
      this.lists.allowedDestinations,
      this.lists.removeRules,
      this.lists.addRules,
    ].forEach(this.emptyList, this);

    this.$id("rpc-other-origins")!.hidden = true;
    this.$id("rpc-blocked-destinations")!.hidden = true;
    this.$id("rpc-mixed-destinations")!.hidden = true;
    this.$id("rpc-allowed-destinations")!.hidden = true;
    // TODO: show some message about why the menu is empty.
  }

  private populateList(list: IList, values: any) {
    this.emptyList(list);

    // check whether there are objects of GUILocation or just strings
    const guiLocations = values[0] && values[0] instanceof GUILocation;

    if (true === guiLocations) {
      // get prefs
      const sorting = this.cachedSettings.get("menu.sorting");
      const showNumRequests =
          this.cachedSettings.get("menu.info.showNumRequests");

      if (sorting === "numRequests") {
        values.sort(GUILocation.sortByNumRequestsCompareFunction);
      } else if (sorting === "destName") {
        values.sort(GUILocation.compareFunction);
      }

      // tslint:disable-next-line:forin
      for (const i in values) {
        const guiLocation = values[i];
        const props = guiLocation.properties;

        let num;
        if (true === showNumRequests) {
          num = props.numRequests;
          if (props.numAllowedRequests > 0 && props.numBlockedRequests > 0) {
            num += ` (${props.numBlockedRequests
            }+${props.numAllowedRequests})`;
          }
        }
        const newitem = this.addListItem(
            list, "rpc-od-item", guiLocation, num,
        );

        newitem.setAttribute(
            "default-policy",
            props.numDefaultPolicyRequests > 0 ? "true" : "false",
        );
        newitem.setAttribute(
            "requests-blocked",
            props.numBlockedRequests > 0 ? "true" : "false",
        );
      }
    } else {
      values.sort();
      // tslint:disable-next-line:forin
      for (const i in values) {
        this.addListItem(list, "rpc-od-item", values[i]);
      }
    }
  }

  private populateOrigin() {
    this.originDomainnameItem.textContent = this.currentBaseDomain;
    this.isUncontrollableOrigin = false;

    const showNumRequests =
        this.cachedSettings.get("menu.info.showNumRequests");

    const props = this.getOriginGUILocationProperties();

    let numRequests = "";
    if (true === showNumRequests) {
      if (props.numAllowedRequests > 0 && props.numBlockedRequests > 0) {
        numRequests = `${props.numRequests}\u00a0(` +
            `${props.numBlockedRequests}+${props.numAllowedRequests})`;
      } else {
        numRequests = `${props.numRequests}`;
      }
    }
    this.originNumRequestsItem.textContent = numRequests;

    this.originItem.setAttribute(
        "default-policy",
        props.numDefaultPolicyRequests > 0 ? "true" : "false",
    );
    this.originItem.setAttribute(
        "requests-blocked",
        props.numBlockedRequests > 0 ? "true" : "false",
    );
  }

  private populateOtherOrigins() {
    const guiOrigins = this.getOtherOriginsAsGUILocations();
    this.populateList(this.lists.otherOrigins!, guiOrigins);
    this.$id("rpc-other-origins")!.hidden = guiOrigins.length === 0;
  }

  private populateDestinations() {
    const destsWithBlockedRequests =
        this.getBlockedDestinationsAsGUILocations();
    const destsWithAllowedRequests =
        this.getAllowedDestinationsAsGUILocations();

    const destsWithSolelyBlockedRequests = [];
    const destsMixed = [];
    const destsWithSolelyAllowedRequests = [];

    // Set operations would be nice. These are small arrays, so keep it simple.
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < destsWithBlockedRequests.length; i++) {
      const blockedGUIDest = destsWithBlockedRequests[i];

      if (false === GUILocation.existsInArray(
          blockedGUIDest,
          destsWithAllowedRequests,
      )) {
        destsWithSolelyBlockedRequests.push(blockedGUIDest);
      } else {
        destsMixed.push(blockedGUIDest);
      }
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < destsWithAllowedRequests.length; i++) {
      const allowedGUIDest = destsWithAllowedRequests[i];

      const indexRawBlocked = GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsWithBlockedRequests);
      const destsMixedIndex = GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsMixed);

      if (indexRawBlocked === -1) {
        destsWithSolelyAllowedRequests.push(allowedGUIDest);
      } else {
        if (destsMixedIndex !== -1) {
          log.info(`Merging dest: <${allowedGUIDest}>`);
          destsMixed[destsMixedIndex] = GUIDestination.merge(
              allowedGUIDest, destsMixed[destsMixedIndex],
          );
        } else {
          // If the allowedGUIDest is in destsWithBlockedRequests and
          // destsWithAllowedRequests, but not in destsMixed.
          // This should never happen, the destsMixed destination should have
          // been added in the destsWithBlockedRequests-loop.
          log.warn(`${"mixed dest was" +
              " not added to `destsMixed` list: <"}${allowedGUIDest}>`);
          destsMixed.push(allowedGUIDest);
        }
      }
    }

    this.populateList(
        this.lists.blockedDestinations!,
        destsWithSolelyBlockedRequests,
    );
    this.$id("rpc-blocked-destinations")!.hidden =
        destsWithSolelyBlockedRequests.length === 0;

    this.populateList(this.lists.mixedDestinations!, destsMixed);
    this.$id("rpc-mixed-destinations")!.hidden = destsMixed.length === 0;

    this.populateList(
        this.lists.allowedDestinations!,
        destsWithSolelyAllowedRequests,
    );
    this.$id("rpc-allowed-destinations")!.hidden =
        destsWithSolelyAllowedRequests.length === 0;
  }

  // eslint-disable-next-line complexity
  private populateDetails() {
    const origin = this.currentlySelectedOrigin;
    const dest = this.currentlySelectedDest;

    this.emptyList(this.lists.removeRules!);
    this.emptyList(this.lists.addRules!);

    const ruleData: IRuleSpec = {
      o: {
        h: this.addWildcard(origin),
      },
    };

    const mayPermRulesBeAdded = this.privateBrowsingService.
        mayPermanentRulesBeAdded(this.window);

    // Note: in PBR we'll need to still use the old string for the temporary
    // rule. We won't be able to use just "allow temporarily".

    if (!this.currentlySelectedDest) {
      if (this.cachedSettings.alias.isDefaultAllow()) {
        if (mayPermRulesBeAdded === true) {
          this.addMenuItemDenyOrigin(this.lists.addRules!, ruleData);
        }
        this.addMenuItemTempDenyOrigin(this.lists.addRules!, ruleData);
      } else {
        if (mayPermRulesBeAdded === true) {
          this.addMenuItemAllowOrigin(this.lists.addRules!, ruleData);
        }
        this.addMenuItemTempAllowOrigin(this.lists.addRules!, ruleData);
      }
    }

    if (dest) {
      ruleData.d = {
        h: this.addWildcard(dest),
      };
      const destOnlyRuleData = {
        d: {
          h: this.addWildcard(dest),
        },
      };
      // if (this.cachedSettings.alias.isDefaultAllow()) {
      if (this.isCurrentlySelectedDestAllowed ||
          !this.policy.ruleExists(C.RULE_ACTION_DENY, ruleData) &&
              !this.policy.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
        // show "Block requests" if the destination was allowed
        // OR if there's no blocking rule (i.e. the request was blocked
        // "by default") -- this enables support for blacklisting.
        if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
            !this.policy.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
          if (mayPermRulesBeAdded === true) {
            this.addMenuItemDenyOriginToDest(this.lists.addRules!, ruleData);
          }
          this.addMenuItemTempDenyOriginToDest(this.lists.addRules!, ruleData);
        }

        if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !this.policy.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
          if (mayPermRulesBeAdded === true) {
            this.addMenuItemDenyDest(this.lists.addRules!, destOnlyRuleData);
          }
          this.addMenuItemTempDenyDest(this.lists.addRules!, destOnlyRuleData);
        }
      }
      if (this.isCurrentlySelectedDestBlocked ||
          !this.policy.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
              !this.policy.ruleExists(
                  C.RULE_ACTION_ALLOW,
                  destOnlyRuleData,
              )) {
        // show "Allow requests" if the destination was blocked
        // OR if there's no allow-rule (i.e. the request was allowed
        // "by default") -- this enables support for whitelisting.
        if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
            !this.policy.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
          if (mayPermRulesBeAdded === true) {
            this.addMenuItemAllowOriginToDest(this.lists.addRules!, ruleData);
          }
          this.addMenuItemTempAllowOriginToDest(
              this.lists.addRules!,
              ruleData,
          );
        }

        if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !this.policy.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
          if (mayPermRulesBeAdded === true) {
            this.addMenuItemAllowDest(this.lists.addRules!, destOnlyRuleData);
          }
          this.addMenuItemTempAllowDest(
              this.lists.addRules!,
              destOnlyRuleData,
          );
        }
      }
    }

    if (this.currentlySelectedDest) {
      if (!this.cachedSettings.alias.isDefaultAllow() &&
          !this.cachedSettings.alias.isDefaultAllowSameDomain()) {
        this.populateDetailsAddSubdomainAllowRules(this.lists.addRules!);
      }
    }

    this.populateDetailsRemoveAllowRules(this.lists.removeRules!);
    this.populateDetailsRemoveDenyRules(this.lists.removeRules!);
  }

  private addListItem(
      list: IList,
      cssClass: string,
      value: string,
      numRequests?: number,
  ) {
    const {document} = this.window;
    const box = document.createElement("div");
    box.setAttribute("class", `${cssClass} listen-click`);
    box.addEventListener("click", this.itemSelected, false);
    list.insertBefore(box, null);

    const destLabel = document.createElement("span");
    destLabel.textContent = value;
    destLabel.setAttribute("class", "domainname");
    box.insertBefore(destLabel, null);

    if (numRequests) {
      const numReqLabel = document.createElement("span");
      numReqLabel.textContent = `${numRequests}`;
      numReqLabel.setAttribute("class", "numRequests");
      box.insertBefore(numReqLabel, null);
    }

    return box;
  }

  private setPrivateBrowsingStyles() {
    const mayPermRulesBeAdded = this.privateBrowsingService.
        mayPermanentRulesBeAdded(this.window);
    const val = mayPermRulesBeAdded === true ? "" : "privatebrowsing";
    this.$id("rpc-details")!.setAttribute("class", val);
  }

  private resetSelectedOrigin() {
    this.originItem.setAttribute("selected-origin", "false");
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < this.lists.otherOrigins!.childNodes.length; i++) {
      const child = this.lists.otherOrigins!.childNodes[i] as IListItem;
      child.setAttribute("selected-origin", "false");
    }
  }

  private resetSelectedDest() {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0;
         i < this.lists.blockedDestinations!.childNodes.length;
         i++) {
      const child = this.lists.blockedDestinations!.childNodes[i] as IListItem;
      child.setAttribute("selected-dest", "false");
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < this.lists.mixedDestinations!.childNodes.length; i++) {
      const child = this.lists.mixedDestinations!.childNodes[i] as IListItem;
      child.setAttribute("selected-dest", "false");
    }
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0;
         i < this.lists.allowedDestinations!.childNodes.length;
         i++) {
      const child = this.lists.allowedDestinations!.childNodes[i] as IListItem;
      child.setAttribute("selected-dest", "false");
    }
  }

  private activateOriginItem(item: IListItem) {
    if (item.id === "rpc-origin") {
      // it's _the_ origin
      if (this.isUncontrollableOrigin) {
        return;
      }
      this.currentlySelectedOrigin = this.originDomainnameItem.textContent;
    } else if ((item.parentNode as IList).id === "rpc-other-origins-list") {
      // it's an otherOrigin
      this.currentlySelectedOrigin =
          item.getElementsByClassName("domainname")[0].textContent!;
    }
    this.currentlySelectedDest = null;
    // TODO: if the document's origin (rather than an other origin) is being
    // activated, then regenerate the other origins list, as well.
    this.resetSelectedOrigin();
    item.setAttribute("selected-origin", "true");
    this.populateDestinations();
    this.resetSelectedDest();
    this.populateDetails();
  }

  private activateDestinationItem(item: IListItem) {
    this.currentlySelectedDest =
        item.getElementsByClassName("domainname")[0].textContent;

    const itemParent = item.parentNode as IList;
    if (itemParent.id === "rpc-blocked-destinations-list") {
      this.isCurrentlySelectedDestBlocked = true;
      this.isCurrentlySelectedDestAllowed = false;
    } else if (itemParent.id === "rpc-allowed-destinations-list") {
      this.isCurrentlySelectedDestBlocked = false;
      this.isCurrentlySelectedDestAllowed = true;
    } else {
      this.isCurrentlySelectedDestBlocked = true;
      this.isCurrentlySelectedDestAllowed = true;
    }

    this.resetSelectedDest();
    item.setAttribute("selected-dest", "true");
    this.populateDetails();
  }

private openSiteInfoTab(domain: string) {
    const url = `https://www.mywot.com/en/scorecard/${domain}`;
    this.window.openUILinkIn(url, "tab", {
      inBackground: true,
      relatedToCurrent: true,
    });
  }

private maybeOpenSiteInfoTab(item: IListItem) {
    let domain = null;

    if (item.value) {
      domain = item.value;
    } else {
      const domainLabel = item.querySelector(".domainname");

      if (domainLabel !== null) {
        domain = domainLabel.textContent;
      }
    }

    if (domain === null) {
      console.error("Failed to determine the domain under the mouse button " +
          "after the middle-click.");
      return;
    }

    const dialogMessage = browser.i18n.getMessage("siteInfoConfirm",
        [domain, "https://www.mywot.com"]);
    const alwaysAskPrefName = "confirmSiteInfo";
    const confirmed = this.confirm(dialogMessage, alwaysAskPrefName, {
      // close the menu if the dialog needs to be shown
      onBeforeDialog: () => {
        this.windowService.closeMenu(this.window);
      },
    });
    if (confirmed) {
      this.openSiteInfoTab(domain);
    }
  }

  private processRuleSelection(item: IListItem) {
    const ruleData: IRuleSpec = item.requestpolicyRuleData;
    const ruleAction: RuleActionChange = item.requestpolicyRuleAction;

    let undo;
    if (item.getAttribute("selected-rule") === "true") {
      item.setAttribute("selected-rule", "false");
      undo = true;
    } else {
      item.setAttribute("selected-rule", "true");
      undo = false;
    }

    if (!ruleData) {
      console.error("ruleData is empty in menu._processRuleSelection()");
      return;
    }
    if (!ruleAction) {
      console.error("ruleAction is empty in menu._processRuleSelection()");
      return;
    }

    const canonicalRule = Ruleset.rawRuleToCanonicalString(ruleData);
    log.log(`ruleData: ${canonicalRule}`);
    log.log(`ruleAction: ${ruleAction}`);
    log.log(`undo: ${undo}`);

    // TODO: does all of this get replaced with a generic rule processor that
    // only cares whether it's an allow/deny and temporary and drops the
    // ruleData argument straight into the ruleset?
    // @ts-ignore
    let origin;
    // @ts-ignore
    let dest;
    if (ruleData.o && ruleData.o.h) {
      origin = ruleData.o.h;
    }
    if (ruleData.d && ruleData.d.h) {
      dest = ruleData.d.h;
    }

    if (undo) {
      delete this.ruleChangeQueues[ruleAction][canonicalRule];
    } else {
      this.ruleChangeQueues[ruleAction][canonicalRule] = ruleData;
    }
  }

  private processRuleChange(ruleAction: RuleActionChange, ruleData: IRuleSpec) {
    switch (ruleAction) {
      case "allow":
        this.policy.addAllowRule(ruleData);
        break;
      case "allow-temp":
        this.policy.addTemporaryAllowRule(ruleData);
        break;
      case "stop-allow":
        this.policy.removeAllowRule(ruleData);
        break;
      case "deny":
        this.policy.addDenyRule(ruleData);
        break;
      case "deny-temp":
        this.policy.addTemporaryDenyRule(ruleData);
        break;
      case "stop-deny":
        this.policy.removeDenyRule(ruleData);
        break;
      default:
        // eslint-disable-next-line no-throw-literal
        throw new Error(`action not implemented: ${ruleAction}`);
    }
  }

  // Note by @jsamuel:
  // „It's been too long since I looked at some of the new code.
  //  I think I may have assumed that I'd get rid of the different strictness
  //  levels and just use what is currently called LEVEL_SOP. If using anything
  //  else there will be errors from within getDeniedRequests().“

  private getBlockedDestinationsAsGUILocations() {
    const reqSet = this.requestMemory.getDeniedRequests(
        this.currentlySelectedOrigin, this.allRequestsOnDocument,
    );
    const requests = reqSet.getAllMergedOrigins();

    const result = [];
    // tslint:disable-next-line:forin
    for (const destBase in requests) {
      const properties = new GUILocationProperties();
      properties.accumulate(requests[destBase], C.RULE_ACTION_DENY);
      result.push(new GUIDestination(destBase, properties));
    }
    return result;
  }

  private getAllowedDestinationsAsGUILocations() {
    const reqSet = this.requestMemory.getAllowedRequests(
        this.currentlySelectedOrigin, this.allRequestsOnDocument,
    );
    const requests = reqSet.getAllMergedOrigins();

    const result = [];
    // tslint:disable-next-line:forin
    for (const destBase in requests) {
      // For everybody except users with default deny who are not allowing all
      // requests to the same domain:
      // Ignore the selected origin's domain when listing destinations.
      if (
        this.cachedSettings.alias.isDefaultAllow() ||
          this.cachedSettings.alias.isDefaultAllowSameDomain()
      ) {
        if (destBase === this.currentlySelectedOrigin) {
          continue;
        }
      }

      const properties = new GUILocationProperties();
      properties.accumulate(requests[destBase], C.RULE_ACTION_ALLOW);
      result.push(new GUIDestination(destBase, properties));
    }
    return result;
  }

  /**
   * TODO: optimize this for performance (_getOriginGUILocationProperties and
   * _getOtherOriginsAsGUILocations could be merged.)
   *
   * Get the properties of the "main" origin (the one in the location bar).
   */
  private getOriginGUILocationProperties(): GUILocationProperties {
    const allRequests = this.allRequestsOnDocument.getAll();

    const properties = new GUILocationProperties();

    // tslint:disable-next-line:forin
    for (const originUri in allRequests) {
      const originBase = this.uriService.getBaseDomain(originUri);
      if (originBase !== this.currentBaseDomain) {
        continue;
      }

      // tslint:disable-next-line:forin
      for (const destBase in allRequests[originUri]) {
        properties.accumulate(allRequests[originUri][destBase]);
      }
    }
    return properties;
  }

  private getOtherOriginsAsGUILocations() {
    const allRequests = this.allRequestsOnDocument.getAll();

    const allowSameDomain = this.cachedSettings.alias.isDefaultAllow() ||
        this.cachedSettings.alias.isDefaultAllowSameDomain();

    const guiOrigins: GUIOrigin[] = [];
    // tslint:disable-next-line:forin
    for (const originUri in allRequests) {
      const originBase = this.uriService.getBaseDomain(originUri);
      if (originBase === this.currentBaseDomain) {
        continue;
      }

      // TODO: we should prevent chrome://browser/ URLs from getting anywhere
      // near here in the first place.
      // Is this an issue anymore? This may have been slipping through due to
      // a bug that has since been fixed. Disabling for now.
      // if (originBase === 'browser') {
      //   continue;
      // }

      const guiOriginsIndex = GUIOrigin.indexOfOriginInArray(
          originBase!,
          guiOrigins,
      );
      let properties;
      if (guiOriginsIndex === -1) {
        properties = new GUILocationProperties();
      } else {
        properties = guiOrigins[guiOriginsIndex].properties;
      }
      let addThisOriginBase = false;

      for (const destBase in allRequests[originUri]) {
        // Search for a destBase which wouldn't be allowed by the default
        // policy.
        // TODO: some users might want to know those "other origins" as well.
        //       this should be made possible.

        // For everybody except users with default deny who are not allowing all
        // guiOrigins to the same domain:
        // Only list other origins where there is a destination from that origin
        // that is at a different domain, not just a different subdomain.
        if (allowSameDomain && destBase === originBase) {
          continue;
        }
        addThisOriginBase = true;
        properties.accumulate(allRequests[originUri][destBase]);
      }

      if (addThisOriginBase && guiOriginsIndex === -1) {
        guiOrigins.push(new GUIOrigin(originBase!, properties));
      }
    }
    return guiOrigins;
  }

  private isIPAddressOrSingleName(hostname: string) {
    return this.uriService.isIPAddress(hostname) ||
        hostname.indexOf(".") === -1;
  }

  // TODO: the 12 _addMenuItem* functions below hopefully can be refactored.

  // Stop allowing

  private addMenuItemStopAllowingOrigin(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const originHost = ruleData.o!.h;
    const ruleAction = subscriptionOverride ? "deny" : "stop-allow";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopAllowingOrigin",
        [originHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-allow",
    );
  }

  private addMenuItemStopAllowingDest(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const destHost = ruleData.d!.h;
    const ruleAction = subscriptionOverride ? "deny" : "stop-allow";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopAllowingDestination",
        [destHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-allow",
    );
  }

  private addMenuItemStopAllowingOriginToDest(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    const ruleAction = subscriptionOverride ? "deny" : "stop-allow";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopAllowingOriginToDestination",
        [originHost!, destHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-allow",
    );
  }

  // Allow

  private addMenuItemAllowOrigin(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowOrigin",
        [originHost!],
        "allow",
        "rpc-start-rule rpc-allow",
    );
  }

  private addMenuItemAllowDest(list: IList, ruleData: IRuleSpec) {
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowDestination",
        [destHost!],
        "allow",
        "rpc-start-rule rpc-allow",
    );
  }

  private addMenuItemAllowOriginToDest(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowOriginToDestination",
        [originHost!, destHost!],
        "allow",
        "rpc-start-rule rpc-allow",
    );
  }

  // Allow temp

  private addMenuItemTempAllowOrigin(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowOriginTemporarily",
        [originHost!],
        "allow-temp",
        "rpc-start-rule rpc-allow rpc-temporary",
    );
  }

  private addMenuItemTempAllowDest(list: IList, ruleData: IRuleSpec) {
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowDestinationTemporarily",
        [destHost!],
        "allow-temp",
        "rpc-start-rule rpc-allow rpc-temporary",
    );
  }

  private addMenuItemTempAllowOriginToDest(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "allowOriginToDestinationTemporarily",
        [originHost!, destHost!],
        "allow-temp",
        "rpc-start-rule rpc-allow rpc-temporary",
    );
  }

  // Stop denying

  private addMenuItemStopDenyingOrigin(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const originHost = ruleData.o!.h;
    const ruleAction = subscriptionOverride ? "allow" : "stop-deny";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopDenyingOrigin",
        [originHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-deny",
    );
  }

  private addMenuItemStopDenyingDest(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const destHost = ruleData.d!.h;
    const ruleAction = subscriptionOverride ? "allow" : "stop-deny";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopDenyingDestination",
        [destHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-deny",
    );
  }

  private addMenuItemStopDenyingOriginToDest(
      list: IList,
      ruleData: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    const ruleAction = subscriptionOverride ? "allow" : "stop-deny";
    return this.addMenuItemHelper(
        list,
        ruleData,
        "stopDenyingOriginToDestination",
        [originHost!, destHost!],
        ruleAction,
        "rpc-stop-rule rpc-stop-deny",
    );
  }

  // Deny

  private addMenuItemDenyOrigin(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyOrigin",
        [originHost!],
        "deny",
        "rpc-start-rule rpc-deny",
    );
  }

  private addMenuItemDenyDest(list: IList, ruleData: IRuleSpec) {
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyDestination",
        [destHost!],
        "deny",
        "rpc-start-rule rpc-deny",
    );
  }

  private addMenuItemDenyOriginToDest(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyOriginToDestination",
        [originHost!, destHost!],
        "deny",
        "rpc-start-rule rpc-deny",
    );
  }

  // Deny temp

  private addMenuItemTempDenyOrigin(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyOriginTemporarily",
        [originHost!],
        "deny-temp",
        "rpc-start-rule rpc-deny rpc-temporary",
    );
  }

  private addMenuItemTempDenyDest(list: IList, ruleData: IRuleSpec) {
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyDestinationTemporarily",
        [destHost!],
        "deny-temp",
        "rpc-start-rule rpc-deny rpc-temporary",
    );
  }

  private addMenuItemTempDenyOriginToDest(list: IList, ruleData: IRuleSpec) {
    const originHost = ruleData.o!.h;
    const destHost = ruleData.d!.h;
    return this.addMenuItemHelper(
        list,
        ruleData,
        "denyOriginToDestinationTemporarily",
        [originHost!, destHost!],
        "deny-temp",
        "rpc-start-rule rpc-deny rpc-temporary",
    );
  }

  private addMenuItemHelper(
      list: IList,
      ruleData: IRuleSpec,
      fmtStrName:
          "stopAllowingOrigin" |
          "stopAllowingDestination" |
          "stopAllowingOriginToDestination" |
          "allowOrigin" |
          "allowDestination" |
          "allowOriginToDestination" |
          "allowOriginTemporarily" |
          "allowDestinationTemporarily" |
          "allowOriginToDestinationTemporarily" |
          "stopDenyingOrigin" |
          "stopDenyingDestination" |
          "stopDenyingOriginToDestination" |
          "denyOrigin" |
          "denyDestination" |
          "denyOriginToDestination" |
          "denyOriginTemporarily" |
          "denyDestinationTemporarily" |
          "denyOriginToDestinationTemporarily",
      fmtStrArgs: string[],
      ruleAction: RuleActionChange,
      cssClass: string,
  ) {
    const label = this.i18n.getMessage(fmtStrName, fmtStrArgs);
    const item = this.addListItem(list, "rpc-od-item", label) as IListItem;
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = ruleAction;
    // var statustext = ''; // TODO
    item.setAttribute("class", `rpc-od-item ${cssClass}`);
    const canonicalRule = Ruleset.rawRuleToCanonicalString(ruleData);
    if (this.ruleChangeQueues[ruleAction]) {
      if (this.ruleChangeQueues[ruleAction][canonicalRule]) {
        item.setAttribute("selected-rule", "true");
      }
    }
    return item;
  }

  private addMenuItemRemoveAllowRule(
      list: IList,
      rawRule: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    if (rawRule.o && rawRule.d) {
      return this.addMenuItemStopAllowingOriginToDest(
          list, rawRule,
          subscriptionOverride,
      );
    } else if (rawRule.o) {
      return this.addMenuItemStopAllowingOrigin(
          list, rawRule,
          subscriptionOverride,
      );
    } else if (rawRule.d) {
      return this.addMenuItemStopAllowingDest(
          list, rawRule,
          subscriptionOverride,
      );
    } else {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Invalid rule data: no origin or destination parts.");
    }
  }

  private addMenuItemRemoveDenyRule(
      list: IList,
      rawRule: IRuleSpec,
      subscriptionOverride: boolean,
  ) {
    if (rawRule.o && rawRule.d) {
      return this.addMenuItemStopDenyingOriginToDest(
          list, rawRule,
          subscriptionOverride,
      );
    } else if (rawRule.o) {
      return this.addMenuItemStopDenyingOrigin(
          list, rawRule,
          subscriptionOverride,
      );
    } else if (rawRule.d) {
      return this.addMenuItemStopDenyingDest(
          list, rawRule,
          subscriptionOverride,
      );
    } else {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Invalid rule data: no origin or destination parts.");
    }
  }

  private populateDetailsRemoveAllowRules(list: IList) {
    // TODO: can we avoid calling getAllowedRequests here and reuse a result
    // from calling it earlier?

    const reqSet = this.requestMemory.getAllowedRequests(
        this.currentlySelectedOrigin, this.allRequestsOnDocument,
    );
    const requests = reqSet.getAllMergedOrigins();

    // var rules = {};

    const userRules: IRuleSpecObj = {};
    const subscriptionRules: IRuleSpecObj = {};

    // reqSet.print('allowedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    // var destBase = this.uriService.getBaseDomain(
    //      this._currentlySelectedDest);

    for (const destBase in requests) {
      if (this.currentlySelectedDest &&
          this.currentlySelectedDest !== destBase) {
        continue;
      }

      // tslint:disable-next-line:forin
      for (const destIdent in requests[destBase]) {
        const destinations = requests[destBase][destIdent];
        // tslint:disable-next-line:forin
        for (const destUri in destinations) {
          // This will be null when the request was denied because of a default
          // allow rule. However about any other time?
          // TODO: we at least in default allow mode, we need to give an option
          // to add a deny rule for these requests.
          if (!destinations[destUri]) {
            log.log(`${"destinations[destUri] is null or undefined for " +
                "destUri: "}${destUri}`);
            continue;
          }

          const results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there might be
          // several requests with identical origin and destination URI.)

          // tslint:disable-next-line:forin
          for (const i in results.matchedAllowRules) {
            const [ruleset, match] = results.matchedAllowRules[i];
            const rawRule = Ruleset.matchToRawRule(match);

            if (!this.currentlySelectedDest) {
              if (rawRule.d && rawRule.d.h) {
                continue;
              }
            }

            const rawRuleStr = Ruleset.rawRuleToCanonicalString(rawRule);
            // log.info("matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            if (ruleset.userRuleset) {
              userRules[rawRuleStr] = rawRule;
            } else {
              subscriptionRules[rawRuleStr] = rawRule;
            }
          }
        }
      }
    }

    // tslint:disable-next-line:forin
    for (const i in userRules) {
      this.addMenuItemRemoveAllowRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding a deny rule instead of removing an allow rule. However, the text
    // used for the item needs to be the same as removing an allow rule.
    // tslint:disable-next-line:forin
    for (const i in subscriptionRules) {
      this.addMenuItemRemoveAllowRule(list, subscriptionRules[i], true);
    }
  }

  private populateDetailsRemoveDenyRules(list: IList) {
    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    const reqSet = this.requestMemory.getDeniedRequests(
        this.currentlySelectedOrigin, this.allRequestsOnDocument,
    );
    const requests = reqSet.getAllMergedOrigins();

    // var rules = {};

    const userRules: IRuleSpecObj = {};
    const subscriptionRules: IRuleSpecObj = {};

    reqSet.print("deniedRequests", log.log.bind(log));

    // TODO: there is no dest if no dest is selected (origin only).
    // var destBase = this.uriService.getBaseDomain(
    //     this._currentlySelectedDest);

    for (const destBase in requests) {
      if (this.currentlySelectedDest &&
        this.currentlySelectedDest !== destBase) {
        continue;
      }

      // tslint:disable-next-line:forin
      for (const destIdent in requests[destBase]) {
        const destinations = requests[destBase][destIdent];
        // tslint:disable-next-line:forin
        for (const destUri in destinations) {
          // This will be null when the request was denied because of a default
          // deny rule. However about any other time?
          // TODO: we at least in default deny mode, we need to give an option
          // to add a allow rule for these requests.
          if (!destinations[destUri]) {
            log.log(`${"destinations[destUri] is null or undefined " +
                "for destUri: "}${destUri}`);
            continue;
          }

          const results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there may be
          // several requests with identical origin and destination URI.)

          // tslint:disable-next-line:forin
          for (const i in results.matchedDenyRules) {
            const [ruleset, match] = results.matchedDenyRules[i];
            const rawRule = Ruleset.matchToRawRule(match);

            if (!this.currentlySelectedDest) {
              if (rawRule.d && rawRule.d.h) {
                continue;
              }
            }

            const rawRuleStr = Ruleset.rawRuleToCanonicalString(rawRule);
            // log.info("matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            if (ruleset.userRuleset) {
              userRules[rawRuleStr] = rawRule;
            } else {
              subscriptionRules[rawRuleStr] = rawRule;
            }
          }
        }
      }
    }

    // tslint:disable-next-line:forin
    for (const i in userRules) {
      this.addMenuItemRemoveDenyRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding an allow rule instead of removing a deny rule. However, the text
    // used for the item needs to be the same as removing a deny rule.
    // tslint:disable-next-line:forin
    for (const i in subscriptionRules) {
      this.addMenuItemRemoveDenyRule(list, subscriptionRules[i], true);
    }
  }

  private populateDetailsAddSubdomainAllowRules(list: IList) {
    const origin = this.currentlySelectedOrigin;

    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    const reqSet = this.requestMemory.getDeniedRequests(
        this.currentlySelectedOrigin, this.allRequestsOnDocument,
    );
    const requests = reqSet.getAllMergedOrigins();

    const destHosts = new Set<string>();

    for (const destBase in requests) {
      if (this.currentlySelectedDest &&
          this.currentlySelectedDest !== destBase) {
        continue;
      }
      // tslint:disable-next-line:forin
      for (const destIdent in requests[destBase]) {
        const destinations = requests[destBase][destIdent];
        // tslint:disable-next-line:forin
        for (const destUri in destinations) {
          destHosts.add(this.uriService.getHost(destUri)!);
        }
      }
    }

    const mayPermRulesBeAdded = this.privateBrowsingService.
        mayPermanentRulesBeAdded(this.window);

    for (const destHost of destHosts.values()) {
      const ruleData: IRuleSpec = {
        d: {
          h: destHost,
        },
        o: {
          h: this.addWildcard(origin),
        },
      };
      if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
          !this.policy.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
        if (mayPermRulesBeAdded === true) {
          this.addMenuItemAllowOriginToDest(list, ruleData);
        }
        this.addMenuItemTempAllowOriginToDest(list, ruleData);
      }

      const destOnlyRuleData = {
        d: {
          h: destHost,
        },
      };
      if (!this.policy.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
          !this.policy.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
        if (mayPermRulesBeAdded === true) {
          this.addMenuItemAllowDest(list, destOnlyRuleData);
        }
        this.addMenuItemTempAllowDest(list, destOnlyRuleData);
      }
    }
  }
}
