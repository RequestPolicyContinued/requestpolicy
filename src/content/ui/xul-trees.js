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
    tag: "toolbarbutton", id: "rpcontinuedToolbarButton",
    label: "RequestPolicy", tooltiptext: "RequestPolicy Continued",
    popup: "rpc-popup"
  }
];

exports.mainTree = [
  {parent: {id: (isSeamonkey ? "taskPopup" : "menu_ToolsPopup")},
      tag: "menu", label: "RequestPolicy Continued", accesskey: "r",
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
      tag: "keyset", id: "rpcontinuedKeyset",
  children: [
    {tag: "key", key: "r", modifiers: "accel alt",
        oncommand: "requestpolicy.overlay.openMenuByHotkey()"}
  ]},


  {parent: {special: {type: "__window__"}},
      tag: "popupset", id: "rpcontinuedPopupset",
  children: [
    {tag: "menupopup", id: "rpcontinuedRedirectAddRuleMenu"},
    {tag: "menupopup", id: "rpc-popup", noautohide: "true",
        position: "after_start",
        onpopupshowing: "requestpolicy.overlay.onPopupShowing(event);",
        onpopuphidden: "requestpolicy.overlay.onPopupHidden(event);",
    children: [
      {tag: "vbox", id: "rpc-contents",
      children: [
        {tag: "hbox", id: "rpc-main",
        children: [
          {tag: "vbox", id: "rpc-origins-destinations",
          children: [
            {tag: "hbox", id: "rpc-origin", "class": "rpc-od-item",
                onclick: "requestpolicy.menu.itemSelected(event);",
            children: [
              {tag: "label", id: "rpc-origin-domainname", "class": "domainname",
                  flex: "2"},
              {tag: "label", id: "rpc-origin-num-requests",
                  "class": "numRequests"}
            ]},
            {tag: "vbox", id: "rpc-other-origins",
            children: [
              {tag: "label", id: "rpc-other-origins-title",
                  value: "&rp.menu.otherOrigins;"},
              {tag: "vbox", id: "rpc-other-origins-list",
                  "class": "rpc-label-list"}
            ]},
            {tag: "vbox", id: "rpc-blocked-destinations",
            children: [
              {tag: "label", id: "rpc-blocked-destinations-title",
                  value: "&rp.menu.blockedDestinations;"},
              {tag: "vbox", id: "rpc-blocked-destinations-list",
                  "class": "rpc-label-list"}
            ]},
            {tag: "vbox", id: "rpc-mixed-destinations",
            children: [
              {tag: "label", id: "rpc-mixed-destinations-title",
                  value: "&rp.menu.mixedDestinations;"},
              {tag: "vbox", id: "rpc-mixed-destinations-list",
                  "class": "rpc-label-list"}
            ]},
            {tag: "vbox", id: "rpc-allowed-destinations",
            children: [
              {tag: "label", id: "rpc-allowed-destinations-title",
                  value: "&rp.menu.allowedDestinations;"},
              {tag: "vbox", id: "rpc-allowed-destinations-list",
                  "class": "rpc-label-list"}
            ]}
          ]},
          {tag: "vbox", id: "rpc-details",
          children: [
            {tag: "vbox", id: "rpc-rules-remove"},
            {tag: "vbox", id: "rpc-rules-add"},
            {tag: "vbox", id: "rpc-rules-info"}
          ]}
        ]},
        {tag: "hbox", id: "rpc-revoke-temporary-permissions", hidden: "true",
        children: [
          {tag: "label", value: "&rp.menu.revokeTemporaryPermissions;",
              onclick: "requestpolicy.overlay.revokeTemporaryPermissions();"}
        ]},
        {tag: "hbox", id: "rpc-footer",
        children: [
          {tag: "hbox", id: "rpc-footer-links",
          children: [
            {tag: "label", id: "rpc-link-enable-blocking",
                "class": "rpc-footer-link", value: "&rp.menu.enableBlocking;",
                onclick: "requestpolicy.overlay.toggleTemporarilyAllowAll();"},
            {tag: "label", id: "rpc-link-disable-blocking",
                "class": "rpc-footer-link", value: "&rp.menu.disableBlocking;",
                onclick: "requestpolicy.overlay.toggleTemporarilyAllowAll();"},
            {tag: "label", id: "rpc-link-help", "class": "rpc-footer-link",
                value: "&rp.menu.help;",
                onclick: "requestpolicy.overlay.openHelp();"},
            {tag: "label", id: "rpc-link-prefs", "class": "rpc-footer-link",
                value: "&rp.menu.preferences;",
                onclick: "requestpolicy.overlay.openPrefs(event);"},
            {tag: "label", id: "rpc-link-policies", "class": "rpc-footer-link",
                value: "&rp.menu.managePolicies;",
                onclick: "requestpolicy.overlay.openPolicyManager();"},
            {tag: "label", id: "rpc-link-request-log",
                "class": "rpc-footer-link", value: "&rp.requestLog.title;",
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
