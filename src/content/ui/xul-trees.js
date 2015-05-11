/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

// differences in seamonkey:
// https://developer.mozilla.org/en-US/Add-ons/SeaMonkey_2
let isSeamonkey = appID === C.SEAMONKEY_ID;


exports.toolbarbutton = [
  {parent: {special: {type: "subobject", id: "navigator-toolbox",
      tree: ["palette"]}}, // ("#navigator-toolbox".palette)
    tag: "toolbarbutton", id: "requestpolicyToolbarButton",
    label: "RequestPolicy", tooltiptext: "RequestPolicy",
    popup: "rp-popup"
  }
];

exports.mainTree = [
  {parent: {id: (isSeamonkey ? "taskPopup" : "menu_ToolsPopup")},
      tag: "menu", id: "requestpolicyToolsMenuPopup", label: "RequestPolicy",
      accesskey: "r",
  children: [
    {tag: "menupopup",
    children: [
      {tag: "menuitem", label: "&rp.menu.managePolicies;", accesskey: "m",
          oncommand: "requestpolicy.overlay.openPolicyManager();"},
      {tag: "menuitem", label: "&rp.requestLog.title;", accesskey: "l",
          oncommand: "requestpolicy.overlay.toggleRequestLog(event);"},
      {tag: "menuitem", label: "&rp.menu.preferences;", accesskey: "p",
          oncommand: "requestpolicy.overlay.openPrefs(event);"}
    ]}
  ]},


  {parent: {special: {type: "__window__"}},
      tag: "keyset", id: "requestpolicyKeyset",
  children: [
    {tag: "key", key: "r", modifiers: "accel alt",
        oncommand: "requestpolicy.overlay.openMenuByHotkey()"}
  ]},


  {parent: {special: {type: "__window__"}},
      tag: "popupset", id: "requestpolicyPopupset",
  children: [
    {tag: "menupopup", id: "requestpolicyRedirectAddRuleMenu"},
    {tag: "menupopup", id: "rp-popup", noautohide: "true",
        position: "after_start",
        onpopupshowing: "requestpolicy.overlay.onPopupShowing(event);",
        onpopuphidden: "requestpolicy.overlay.onPopupHidden(event);",
    children: [
      {tag: "vbox", id: "rp-contents",
      children: [
        {tag: "hbox", id: "rp-main",
        children: [
          {tag: "vbox", id: "rp-origins-destinations",
          children: [
            {tag: "hbox", id: "rp-origin", "class": "rp-od-item",
                onclick: "requestpolicy.menu.itemSelected(event);",
            children: [
              {tag: "label", id: "rp-origin-domainname", "class": "domainname",
                  flex: "2"},
              {tag: "label", id: "rp-origin-num-requests",
                  "class": "numRequests"}
            ]},
            {tag: "vbox", id: "rp-other-origins",
            children: [
              {tag: "label", id: "rp-other-origins-title",
                  value: "&rp.menu.otherOrigins;"},
              {tag: "vbox", id: "rp-other-origins-list",
                  "class": "rp-label-list"}
            ]},
            {tag: "vbox", id: "rp-blocked-destinations",
            children: [
              {tag: "label", id: "rp-blocked-destinations-title",
                  value: "&rp.menu.blockedDestinations;"},
              {tag: "vbox", id: "rp-blocked-destinations-list",
                  "class": "rp-label-list"}
            ]},
            {tag: "vbox", id: "rp-mixed-destinations",
            children: [
              {tag: "label", id: "rp-mixed-destinations-title",
                  value: "&rp.menu.mixedDestinations;"},
              {tag: "vbox", id: "rp-mixed-destinations-list",
                  "class": "rp-label-list"}
            ]},
            {tag: "vbox", id: "rp-allowed-destinations",
            children: [
              {tag: "label", id: "rp-allowed-destinations-title",
                  value: "&rp.menu.allowedDestinations;"},
              {tag: "vbox", id: "rp-allowed-destinations-list",
                  "class": "rp-label-list"}
            ]}
          ]},
          {tag: "vbox", id: "rp-details",
          children: [
            {tag: "vbox", id: "rp-rules-remove"},
            {tag: "vbox", id: "rp-rules-add"},
            {tag: "vbox", id: "rp-rules-info"}
          ]}
        ]},
        {tag: "hbox", id: "rp-revoke-temporary-permissions", hidden: "true",
        children: [
          {tag: "label", value: "&rp.menu.revokeTemporaryPermissions;",
              onclick: "requestpolicy.overlay.revokeTemporaryPermissions();"}
        ]},
        {tag: "hbox", id: "rp-footer",
        children: [
          {tag: "hbox", id: "rp-footer-links",
          children: [
            {tag: "label", id: "rp-link-enable-blocking",
                "class": "rp-footer-link", value: "&rp.menu.enableBlocking;",
                onclick: "requestpolicy.overlay.toggleTemporarilyAllowAll();"},
            {tag: "label", id: "rp-link-disable-blocking",
                "class": "rp-footer-link", value: "&rp.menu.disableBlocking;",
                onclick: "requestpolicy.overlay.toggleTemporarilyAllowAll();"},
            {tag: "label", id: "rp-link-help", "class": "rp-footer-link",
                value: "&rp.menu.help;",
                onclick: "requestpolicy.overlay.openHelp();"},
            {tag: "label", id: "rp-link-prefs", "class": "rp-footer-link",
                value: "&rp.menu.preferences;",
                onclick: "requestpolicy.overlay.openPrefs(event);"},
            {tag: "label", id: "rp-link-policies", "class": "rp-footer-link",
                value: "&rp.menu.managePolicies;",
                onclick: "requestpolicy.overlay.openPolicyManager();"},
            {tag: "label", id: "rp-link-request-log", "class": "rp-footer-link",
                value: "&rp.requestLog.title;",
                onclick: "requestpolicy.overlay.toggleRequestLog(event);"}
          ]}
        ]}
      ]}
    ]}
  ]},


  {parent: {id: "appcontent"},
      tag: "splitter", id: "requestpolicy-requestLog-splitter", hidden: "true"},

  {parent: {id: "appcontent"},
      tag: "vbox", id: "requestpolicy-requestLog", height: "300",
      hidden: "true", persist: "height",
  children: [
    {tag: "toolbox", id: "requestpolicy-requestLog-header",
    children: [
      {tag: "toolbar", id: "requestpolicy-requestLog-toolbar",
          align: "center",
      children: [
        {tag: "label", id: "requestpolicy-requestLog-title",
            control: "requestpolicy-requestLog-frame",
            value: "&rp.requestLog.title;", crop: "end"},
        {tag: "button", id: "requestpolicy-requestLog-clear",
            label: "&rp.requestLog.clear;",
            oncommand: "requestpolicy.overlay.clearRequestLog();"},
        {tag: "vbox", flex: "1"},
        {tag: "toolbarbutton", id: "requestpolicy-requestLog-close",
            align: "right",
            oncommand: "requestpolicy.overlay.toggleRequestLog()"}
      ]}
    ]},
    // The src of this iframe is set to
    // chrome://rpcontinued/content/ui/request-log.xul in overlay.js
    {tag: "iframe", id: "requestpolicy-requestLog-frame", type: "chrome",
        flex: "1"}
  ]}
];
