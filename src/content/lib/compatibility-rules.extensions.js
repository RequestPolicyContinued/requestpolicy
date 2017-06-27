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

export default [
  {
    ids: ["greasefire@skrul.com"], // Greasefire
    rules: [
      ["file://", "http://userscripts.org/"],
      ["file://", "http://static.userscripts.org/"],
    ]
  },
  {
    ids: [
      "{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}", // Sage-Too
      "{899DF1F8-2F43-4394-8315-37F6744E6319}", // NewsFox
      "brief@mozdev.org", // Brief
    ],
    rules: [
      ["resource://brief-content/", null],
    ]
  },
  {
    ids: [
      "{899DF1F8-2F43-4394-8315-37F6744E6319}", // NewsFox
    ],
    whitelistedBaseUris: [
      "chrome://newsfox/content/newsfox.xul",
    ],
  },
  {
    ids: ["foxmarks@kei.com"], // Xmarks Sync
    rules: [
      ["https://login.xmarks.com/", "https://static.xmarks.com/"],
    ],
  },
  {
    ids: [
      "{203FB6B2-2E1E-4474-863B-4C483ECCE78E}", // Norton Safe Web Lite
      "{0C55C096-0F1D-4F28-AAA2-85EF591126E7}", // Norton NIS Toolbar
      "{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}", // Norton Toolbar
    ],
    rules: [
      [null, "symnst:"],
      [null, "symres:"],
    ]
  },
  {
    ids: ["{c45c406e-ab73-11d8-be73-000a95be3b12}"], // Web Developer
    rules: [
      ["about:blank", "http://jigsaw.w3.org/css-validator/validator"],
      ["about:blank", "http://validator.w3.org/check"],
    ]
  },
  {
    ids: ["{c07d1a49-9894-49ff-a594-38960ede8fb9}"], // Update Scanner
    topLevelDocTranslationRules: [
      ["chrome://updatescan/content/diffPage.xul", "data:text/html"],
    ]
  },
  {
    ids: ["FirefoxAddon@similarWeb.com"], // SimilarWeb
    rules: [
      ["http://api2.similarsites.com/", "http://images2.similargroup.com/"],
      ["http://www.similarweb.com/", "http://go.similarsites.com/"],
    ]
  },
  {
    ids: ["{6614d11d-d21d-b211-ae23-815234e1ebb5}"], // Dr. Web Link Checker
    rules: [
      [null, "http://st.drweb.com/"],
    ],
  },
  {
    ids: ["keefox@chris.tomlinson"], // KeeFox
    rules: [
      ["resource://", "ws://127.0.0.1"],
    ]
  },
  {
    ids: ["jid1-TPTs1Z1UvUn2fA@jetpack"], // Enpass
    rules: [
      ["resource://jid1-tpts1z1uvun2fa-at-jetpack/enpass/", "ws://localhost"],
    ]
  },
  // @ifdef UI_TESTING
  {
    ids: ["dummy-ext@requestpolicy.org"],
    rules: [
      ["foo://bar", "foo://baz"],
    ],
    topLevelDocTranslationRules: [
      ["foo://bar", "bar://foo"],
    ],
    whitelistedBaseUris: [
      "chrome://dummy-ext/content/overlay.xul",
    ],
  },
  // @endif
];
