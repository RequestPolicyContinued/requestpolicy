/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
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

import * as JQuery from "jquery";
import {BackgroundPage} from "main";
import {$id, elManager, WinEnv} from "settings/common";

declare const $: typeof JQuery;

(() => {
  const {
    C,
    RuleUtils,
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;

  const $str = browser.i18n.getMessage.bind(browser.i18n);

  // ===========================================================================

  $(() => {
    // l10n for input placeholders.
    $id("rulesearch").placeholder = $str("search");
    $("[name=originscheme]").prop("placeholder", $str("scheme"));
    $("[name=destscheme]").prop("placeholder", $str("scheme"));
    $("[name=originhost]").prop("placeholder", $str("host"));
    $("[name=desthost]").prop("placeholder", $str("host"));
    $("[name=originport]").prop("placeholder", $str("port"));
    $("[name=destport]").prop("placeholder", $str("port"));
  });

  const SEARCH_DELAY = 100;

  let searchTimeoutId: any = null;

  function populateRuleTable(filter: any) {
    // FIXME: populating the rules table is very slow

    searchTimeoutId = null;

    const table = $id("rules");

    clearRulesTable(table);

    let entries;

    // Get and display user rules
    const user = rp.policy.getUserRulesets().user;
    entries = user.rawRuleset.raw.entries;
    addRules(entries, "User", filter, false);

    // Get and display temorary rules
    const temp = rp.policy.getUserRulesets().temp;
    entries = temp.rawRuleset.raw.entries;
    addRules(entries, "Temporary", filter, false);

    if (!C.UI_TESTING) {
      // Get and display subscription rules
      // (Ignore subscription rules when UI testing.)
      const subscriptionLists = rp.policy.subscriptions.getRulesets();
      // tslint:disable-next-line:forin
      for (const subscriptionList in subscriptionLists) {
        // tslint:disable-next-line:forin
        for (const subscription in subscriptionLists[subscriptionList]) {
          entries = subscriptionLists[subscriptionList][subscription].
              rawRuleset.raw.entries;
          addRules(entries, subscription, filter, true);
        }
      }
    }
  }

  function addRules(entries: any, source: any, filter: any, readOnly: any) {
    const table = $("#rules");
    // tslint:disable-next-line:forin
    for (const entryType in entries) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < entries[entryType].length; i++) {
        const entry = entries[entryType][i];
        const origin = entry.o ?
          RuleUtils.endpointSpecToDisplayString(entry.o) : "";
        const dest = entry.d ?
          RuleUtils.endpointSpecToDisplayString(entry.d) : "";
        if (filter) {
          if (origin.indexOf(filter) === -1 && dest.indexOf(filter) === -1) {
            continue;
          }
        }
        addRulesTableRow(
            table, entryType, origin, dest, entry, source,
            readOnly,
        );
      }
    }
  }

  function deleteRule(event: any) {
    // TODO: the rule should not be referenced by the rule data but
    //       by some unique identifier. Currently, if there's exactly
    //       the same rule twice, (one of them might be a temporary
    //       rule), both will get removed.
    const anchor = $(event.target);
    const ruleAction = anchor.data("requestpolicyRuleAction");
    const ruleData = anchor.data("requestpolicyRuleData");
    if (ruleAction === "allow") {
      rp.policy.removeAllowRule(ruleData);
    } else {
      rp.policy.removeDenyRule(ruleData);
    }
    anchor.closest("tr").remove();
  }

  function clearRulesTable(table: any) {
    const children = table.getElementsByTagName("tr");
    while (children.length) {
      const child = children.item(0);
      child.parentNode.removeChild(child);
    }
  }

  function addRulesTableRow(
      table: any,
      aRuleAction: any,
      origin: any,
      dest: any,
      ruleData: any,
      source: any,
      readOnly: any,
  ) {
    const ruleAction = aRuleAction === "allow" ? "allow" : "block";
    const ruleActionString = $str(ruleAction);

    const row = $("<tr>").addClass(ruleAction).appendTo(table);

    row.append(
        $("<td>").text(ruleActionString),
        $("<td>").text(origin),
        $("<td>").text(dest),
        $("<td>").text(source),
    );

    if (!readOnly) {
      const anchor = $("<a>");
      anchor.text("x").addClass("deleterule");
      anchor.data("requestpolicyRuleAction", ruleAction);
      anchor.data("requestpolicyRuleData", ruleData);
      anchor.click(deleteRule);
      row.append($("<td>").append(anchor));
    } else {
      row.append($("<td>"));
    }
  }

  (window as any).addRule = () => {
    try {
      addRuleHelper();
    } catch (e) {
      console.error("yourpolicy: addRule():");
      console.dir(e);
      window.alert(`Unable to add rule: ${e.toString()}`);
      return;
    }

    // the table is repopulated through the RulesChangedObserver
  };

  function addRuleHelper() {
    const form = (document.forms as any).addruleform;
    const allow = form.elements.allowrule.checked ? true : false;
    const temporary = form.elements.temporary.checked ? true : false;
    const originScheme = form.elements.originscheme.value;
    const originHost = form.elements.originhost.value;
    const originPort = form.elements.originport.value;
    const destScheme = form.elements.destscheme.value;
    const destHost = form.elements.desthost.value;
    const destPort = form.elements.destport.value;
    // TODO: we either need to sanity check the ruleData here
    //       or the policy needs to do this when it is added.
    //       Probably better to do it in the policy code.
    function ruleInfoToRuleDataPart(scheme: any, host: any, port: any) {
      if (!scheme && !host && !port) {
        return null;
      }
      const part: any = {};
      if (scheme) {
        part.s = scheme;
      }
      if (host) {
        part.h = host;
      }
      if (port) {
        part.port = port;
      }
      return part;
    }
    const originPart = ruleInfoToRuleDataPart(
        originScheme, originHost,
        originPort,
    );
    const destPart = ruleInfoToRuleDataPart(destScheme, destHost, destPort);
    if (!originPart && !destPart) {
      return;
    }
    const ruleData: any = {};
    if (originPart) {
      ruleData.o = originPart;
    }
    if (destPart) {
      ruleData.d = destPart;
    }
    if (allow) {
      if (temporary) {
        rp.policy.addTemporaryAllowRule(ruleData);
      } else {
        rp.policy.addAllowRule(ruleData);
      }
    } else {
      if (temporary) {
        rp.policy.addTemporaryDenyRule(ruleData);
      } else {
        rp.policy.addDenyRule(ruleData);
      }
    }
  }

  window.onload = () => {
    {
      const search = $id("rulesearch");
      elManager.addListener(search, "keyup", (event: any) => {
        if (searchTimeoutId !== null) {
          window.clearTimeout(searchTimeoutId);
        }
        // FIXME: use 'setTimeout' of 'Module'
        searchTimeoutId = window.setTimeout(() => {  // badword-linter:allow:window.setTimeout:
          populateRuleTable(event.target.value);
        }, SEARCH_DELAY);
      }, false);
      populateRuleTable(search.value);
      if (rp.services.rules.v0.oldRulesExist()) {
        $("#oldrulesexist").show();
      }
    }

    // observe rule changes and update the table then
    WinEnv.obMan.observe(["rpcontinued-rules-changed"], () => {
      const search = $id("rulesearch");
      populateRuleTable(search.value);
    });
  };
})();
