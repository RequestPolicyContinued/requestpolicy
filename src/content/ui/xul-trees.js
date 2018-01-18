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

/* global exports: true, C, appID */

// differences in seamonkey:
// https://developer.mozilla.org/en-US/Add-ons/SeaMonkey_2
let isSeamonkey = appID === C.SEAMONKEY_ID;

/* eslint-disable max-len */

exports.toolbarbutton = [
  {
    parent: {
      // $("#navigator-toolbox").palette
      special: {
        type: "subobject",
        id: "navigator-toolbox",
        tree: ["palette"],
      },
    },

    tag: "toolbarbutton",
    attributes: {
      id: "rpcontinuedToolbarButton",
      label: "RequestPolicy",
      tooltiptext: "RequestPolicy Continued",
      popup: "rpc-popup",
    },
  },
];

exports.mainTree = [
  {
    parent: {id: isSeamonkey ? "taskPopup" : "menu_ToolsPopup"},

    tag: "menu",
    attributes: {label: "RequestPolicy Continued",
                 accesskey: "r"},
    children: [
      {
        tag: "menupopup",
        children: [
          {
            tag: "menuitem",
            attributes: {label: "__MSG_managePolicies@menu__",
                         accesskey: "m"},
            events: {command: ["overlay", "openPolicyManager"]},
          },
          {
            tag: "menuitem",
            attributes: {label: "__MSG_rp_requestLog_title__",
                         accesskey: "l"},
            events: {command: ["overlay", "toggleRequestLog"]},
          },
          {
            tag: "menuitem",
            attributes: {label: "__MSG_rp_menu_preferences__",
                         accesskey: "p"},
            events: {command: ["overlay", "openPrefs"]},
          },
        ],
      },
    ],
  },

  {
    parent: {id: "contentAreaContextMenu"},

    tag: "menuitem",
    attributes: {id: "rpcontinuedContextMenuEntry",
                 label: "RequestPolicy Continued"},
    events: {command: ["overlay", "toggleMenu"]},
  },

  {
    parent: {special: {type: "__window__"}},

    tag: "keyset",
    attributes: {id: "rpcontinuedKeyset"},
  },

  {
    parent: {special: {type: "__window__"}},

    tag: "popupset",
    attributes: {id: "rpcontinuedPopupset"},
    children: [
      {
        tag: "menupopup",
        attributes: {id: "rpcontinuedRedirectAddRuleMenu"},
      }, {
        tag: "menupopup",
        attributes: {id: "rpc-popup",
                     noautohide: "true",
                     position: "after_start"},
        events: {popupshowing: ["overlay", "onPopupShowing"],
                 popuphidden: ["overlay", "onPopupHidden"]},
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
                                     class: "rpc-od-item"},
                        events: {click: ["menu", "itemSelected"]},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-origin-domainname",
                                         class: "domainname",
                                         flex: "2"},
                          }, {
                            tag: "label",
                            attributes: {id: "rpc-origin-num-requests",
                                         class: "numRequests"},
                          },
                        ],
                      },
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-other-origins"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-other-origins-title",
                                         value: "__MSG_rp_menu_otherOrigins__"},
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-other-origins-list",
                                         class: "rpc-label-list"},
                          },
                        ],
                      },
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-blocked-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-blocked-destinations-title",
                                         value: "__MSG_rp_menu_blockedDestinations__"},
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-blocked-destinations-list",
                                         class: "rpc-label-list"},
                          },
                        ],
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-mixed-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-mixed-destinations-title",
                                         value: "__MSG_rp_menu_mixedDestinations__"},
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-mixed-destinations-list",
                                         class: "rpc-label-list"},
                          },
                        ],
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-allowed-destinations"},
                        children: [
                          {
                            tag: "label",
                            attributes: {id: "rpc-allowed-destinations-title",
                                         value: "__MSG_rp_menu_allowedDestinations__"},
                          }, {
                            tag: "vbox",
                            attributes: {id: "rpc-allowed-destinations-list",
                                         class: "rpc-label-list"},
                          },
                        ],
                      },
                    ],
                  },
                  // [END] LEFT MENU COLUMN
                  // [BEGIN] RIGHT MENU COLUMN
                  {
                    tag: "vbox",
                    attributes: {id: "rpc-details"},
                    children: [
                      {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-remove"},
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-add"},
                      }, {
                        tag: "vbox",
                        attributes: {id: "rpc-rules-info"},
                      },
                    ],
                  },
                  // [END] RIGHT MENU COLUMN
                ],
              }, {
                tag: "hbox",
                attributes: {id: "rpc-revoke-temporary-permissions",
                             hidden: "true"},
                children: [
                  {
                    tag: "label",
                    attributes: {value: "__MSG_rp_menu_revokeTemporaryPermissions__"},
                    events: {click: ["overlay", "revokeTemporaryPermissions"]},
                  },
                ],
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
                                     class: "rpc-footer-link",
                                     value: "__MSG_rp_menu_enableBlocking__"},
                        events: {click: ["overlay",
                                         "toggleTemporarilyAllowAll"]},
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-disable-blocking",
                                     class: "rpc-footer-link",
                                     value: "__MSG_rp_menu_disableBlocking__"},
                        events: {click: ["overlay",
                                         "toggleTemporarilyAllowAll"]},
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-help",
                                     class: "rpc-footer-link",
                                     value: "__MSG_rp_menu_help__"},
                        events: {click: ["overlay", "openHelp"]},
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-prefs",
                                     class: "rpc-footer-link",
                                     value: "__MSG_rp_menu_preferences__"},
                        events: {click: ["overlay", "openPrefs"]},
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-policies",
                                     class: "rpc-footer-link",
                                     value: "__MSG_managePolicies@menu__"},
                        events: {click: ["overlay", "openPolicyManager"]},
                      }, {
                        tag: "label",
                        attributes: {id: "rpc-link-request-log",
                                     class: "rpc-footer-link",
                                     value: "__MSG_rp_requestLog_title__"},
                        events: {click: ["overlay", "toggleRequestLog"]},
                      },
                    ],
                  },
                ],
              },
              // [END] MENU FOOTER
            ],
          },
        ],
      },
    ],
  },

  {
    parent: {id: "appcontent"},
    tag: "splitter",
    attributes: {id: "rpcontinued-requestLog-splitter",
                 hidden: "true"},
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
                             value: "__MSG_rp_requestLog_title__",
                             crop: "end"},
              }, {
                tag: "button",
                attributes: {id: "rpcontinued-requestLog-clear",
                             label: "__MSG_rp_requestLog_clear__"},
                events: {command: ["overlay", "clearRequestLog"]},
              }, {
                tag: "vbox",
                attributes: {flex: "1"},
              }, {
                tag: "toolbarbutton",
                attributes: {id: "rpcontinued-requestLog-close",
                             align: "right"},
                events: {command: ["overlay", "toggleRequestLog"]},
              },
            ],
          },
        ],
      },
      // The src of this iframe is set to
      // chrome://rpcontinued/content/ui/request-log/request-log.xul in overlay.js
      {
        tag: "iframe",
        attributes: {id: "rpcontinued-requestLog-frame",
                     type: "chrome",
                     flex: "1"},
      },
    ],
  },
];
