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
  {
    parent: {
      // $("#navigator-toolbox").palette
      special: {
        type: "subobject",
        id: "navigator-toolbox",
        tree: ["palette"]
      }
    },

    tag: "toolbarbutton",
    attributes: {
      id: "rpcontinuedToolbarButton",
      label: "RequestPolicy",
      tooltiptext: "RequestPolicy Continued",
      popup: "rpc-popup"
    }
  }
];

exports.mainTree = [
  {
    parent: {id: (isSeamonkey ? "taskPopup" : "menu_ToolsPopup")},

    tag: "menu",
    attributes: {label: "RequestPolicy Continued",
                 accesskey: "r"},
    children: [
      {
        tag: "menupopup",
        children: [
          {
            tag: "menuitem",
            attributes: {label: "&rp.menu.managePolicies;",
                         accesskey: "m",
                         oncommand: "rpcontinued.overlay.openPolicyManager();"}
          },
          {
            tag: "menuitem",
            attributes: {label: "&rp.requestLog.title;",
                         accesskey: "l",
                         oncommand: "rpcontinued.overlay.toggleRequestLog(event);"}
          },
          {
            tag: "menuitem",
            attributes: {label: "&rp.menu.preferences;",
                         accesskey: "p",
                         oncommand: "rpcontinued.overlay.openPrefs(event);"}
          }
        ]
      }
    ]
  },


  {
    parent: {special: {type: "__window__"}},

    tag: "keyset",
    attributes: {id: "rpcontinuedKeyset"},
    children: [
      {
        tag: "key",
        attributes: {key: "r",
                     modifiers: "accel alt",
                     oncommand: "rpcontinued.overlay.openMenuByHotkey()"}
      }
    ]
  },


  {
    parent: {special: {type: "__window__"}},

    tag: "popupset",
    attributes: {id: "rpcontinuedPopupset"},
    children: [
      {
        tag: "menupopup",
        attributes: {id: "rpcontinuedRedirectAddRuleMenu"}
      }, {
        tag: "menupopup",
        attributes: {id: "rpc-popup",
                     noautohide: "true",
                     position: "after_start",
                     onpopupshowing: "rpcontinued.overlay.onPopupShowing(event);",
                     onpopuphidden: "rpcontinued.overlay.onPopupHidden(event);"},
        children: [
          {
            tag: "vbox",
            attributes: {id: "rpc-contents"},
            children: [
              {
                tag: "hbox",
                attributes: {id: "rpc-main"},
                children: [
                  // [BEGIN] LEFT MENU COLUMN
                  {
                    tag: "vbox",
                    attributes: {id: "rpc-origins-destinations"},
                    children: [
                      {
                        tag: "hbox",
                        attributes: {id: "rpc-origin",
                                     "class": "rpc-od-item",
                                     onclick: "rpcontinued.menu.itemSelected(event);"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-origin-domainname",
                                         "class": "domainname",
                                         flex: "2"}
                          }, {
                            tag: "label",
                            attributes: {id: "rpc-origin-num-requests",
                                         "class": "numRequests"}
                          }
                        ]
                      },
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-other-origins"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-other-origins-title",
                                         value: "&rp.menu.otherOrigins;"}
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-other-origins-list",
                                         "class": "rpc-label-list"}
                          }
                        ]
                      },
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-blocked-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-blocked-destinations-title",
                                         value: "&rp.menu.blockedDestinations;"}
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-blocked-destinations-list",
                                         "class": "rpc-label-list"}
                          }
                        ]
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-mixed-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-mixed-destinations-title",
                                         value: "&rp.menu.mixedDestinations;"}
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-mixed-destinations-list",
                                         "class": "rpc-label-list"}
                          }
                        ]
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-allowed-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-allowed-destinations-title",
                                         value: "&rp.menu.allowedDestinations;"}
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-allowed-destinations-list",
                                         "class": "rpc-label-list"}
                          }
                        ]
                      }
                    ]
                  },
                  // [END] LEFT MENU COLUMN
                  // [BEGIN] RIGHT MENU COLUMN
                  {
                    tag: "vbox",
                    attributes: {id: "rpc-details"},
                    children: [
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-remove"}
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-add"}
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-info"}
                      }
                    ]
                  }
                  // [END] RIGHT MENU COLUMN
                ]
              }, {
                tag: "hbox",
                attributes: {id: "rpc-revoke-temporary-permissions",
                             hidden: "true"},
                children: [
                  {
                    tag: "label",
                    attributes: {value: "&rp.menu.revokeTemporaryPermissions;",
                                 onclick: "rpcontinued.overlay.revokeTemporaryPermissions();"}
                  }
                ]
              },
              // [BEGIN] MENU FOOTER
              {
                tag: "hbox",
                attributes: {id: "rpc-footer"},
                children: [
                  {
                    tag: "hbox",
                    attributes: {id: "rpc-footer-links"},
                    children: [
                      {
                        tag: "label",
                        attributes: {id: "rpc-link-enable-blocking",
                                     "class": "rpc-footer-link",
                                     value: "&rp.menu.enableBlocking;",
                                     onclick: "rpcontinued.overlay.toggleTemporarilyAllowAll();"}
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-disable-blocking",
                                     "class": "rpc-footer-link",
                                     value: "&rp.menu.disableBlocking;",
                                     onclick: "rpcontinued.overlay.toggleTemporarilyAllowAll();"}
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-help",
                                     "class": "rpc-footer-link",
                                     value: "&rp.menu.help;",
                                     onclick: "rpcontinued.overlay.openHelp();"}
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-prefs",
                                     "class": "rpc-footer-link",
                                     value: "&rp.menu.preferences;",
                                     onclick: "rpcontinued.overlay.openPrefs(event);"}
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-policies",
                                     "class": "rpc-footer-link",
                                     value: "&rp.menu.managePolicies;",
                                     onclick: "rpcontinued.overlay.openPolicyManager();"}
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-request-log",
                                     "class": "rpc-footer-link",
                                     value: "&rp.requestLog.title;",
                                     onclick: "rpcontinued.overlay.toggleRequestLog(event);"}
                      }
                    ]
                  }
                ]
              }
              // [END] MENU FOOTER
            ]
          }
        ]
      }
    ]
  },


  {
    parent: {id: "appcontent"},
    tag: "splitter",
    attributes: {id: "rpcontinued-requestLog-splitter",
                 hidden: "true"}
  },
  {
    parent: {id: "appcontent"},
    tag: "vbox",
    attributes: {id: "rpcontinued-requestLog",
                 height: "300",
                 hidden: "true",
                 persist: "height"},
    children: [
      {
        tag: "toolbox",
        attributes: {id: "rpcontinued-requestLog-header"},
        children: [
          {
            tag: "toolbar",
            attributes: {id: "rpcontinued-requestLog-toolbar",
                         align: "center"},
            children: [
              {
                tag: "label",
                attributes: {id: "rpcontinued-requestLog-title",
                             control: "rpcontinued-requestLog-frame",
                             value: "&rp.requestLog.title;",
                             crop: "end"}
              }, {
                tag: "button",
                attributes: {id: "rpcontinued-requestLog-clear",
                             label: "&rp.requestLog.clear;",
                             oncommand: "rpcontinued.overlay.clearRequestLog();"}
              }, {
                tag: "vbox",
                attributes: {flex: "1"}
              }, {
                tag: "toolbarbutton",
                attributes: {id: "rpcontinued-requestLog-close",
                             align: "right",
                             oncommand: "rpcontinued.overlay.toggleRequestLog()"}
              }
            ]
          }
        ]
      },
      // The src of this iframe is set to
      // chrome://rpcontinued/content/ui/request-log.xul in overlay.js
      {
        tag: "iframe",
        attributes: {id: "rpcontinued-requestLog-frame",
                     type: "chrome",
                     flex: "1"}
      }
    ]
  }
];
