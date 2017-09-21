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

export default {
  all: [
    // Mozilla updates (doing this for all applications, not just individual
    // applications from the Mozilla community that I'm aware of).
    // At least the http url is needed for Firefox updates, adding the https
    // one as well to be safe.
    ["http://download.mozilla.org/", null],
    ["https://download.mozilla.org/", null],
    // There are redirects from 'addons' to 'releases' when installing addons
    // from AMO. Adding the origin of 'releases' to be safe in case those
    // start redirecting elsewhere at some point.
    ["http://addons.mozilla.org/", null],
    ["https://addons.mozilla.org/", null],
    ["http://releases.mozilla.org/", null],
    ["https://releases.mozilla.org/", null],
    // Firefox 4 has the about:addons page open an iframe to the mozilla site.
    // That opened page grabs content from other mozilla domains.
    ["about:addons", "https://services.addons.mozilla.org/"],
    ["about:addons", "https://discovery.addons.mozilla.org/"],
    [
      "https://services.addons.mozilla.org/",
      "https://static.addons.mozilla.net/",
    ], [
      "https://services.addons.mozilla.org/",
      "https://addons.mozilla.org/",
    ], [
      "https://services.addons.mozilla.org/",
      "https://www.mozilla.com/",
    ], [
      "https://services.addons.mozilla.org/",
      "https://www.getpersonas.com/",
    ], [
      "https://services.addons.mozilla.org/",
      "https://static-cdn.addons.mozilla.net/",
    ], [
      "https://services.addons.mozilla.org/",
      "https://addons.cdn.mozilla.net/",
    ],
    // Firefox 4 uses an about:home page that is locally stored but can be
    // the origin for remote requests. See bug #140 for more info.
    ["about:home", null],
    // Firefox Sync uses a google captcha.
    [
      "https://auth.services.mozilla.com/",
      "https://api-secure.recaptcha.net/challenge?",
    ], [
      "https://api-secure.recaptcha.net/challenge?",
      "https://www.google.com/recaptcha/api/challenge?",
    ], [
      "https://auth.services.mozilla.com/",
      "https://www.google.com/recaptcha/api/",
    ],
    // Firefox 13 added links from about:newtab
    ["about:newtab", null],

    // Firefox Hello
    // FIXME: Along with #742, convert these rules into the following ones:
    //   - ALLOW "about:loopconversation" -> "https://hlg.tokbox.com"
    //   - ALLOW "about:loopconversation" -> "https://anvil.opentok.com"
    //   - ALLOW "about:loopconversation" -> "wss://*.tokbox.com"
    [
      "about:loopconversation",
      "https://hlg.tokbox.com/",
    ], [
      "about:loopconversation",
      "https://anvil.opentok.com/",
    ], [
      "about:loopconversation",
      "wss://",
    ],
  ],

  Firefox: [
    // Firefox Accounts
    [
      "about:accounts",
      "https://accounts.firefox.com/",
    ], [
      "https://accounts.firefox.com/",
      "https://api.accounts.firefox.com/",
    ], [
      "https://accounts.firefox.com/",
      "https://accounts.cdn.mozilla.net/",
    ],
  ],

  // Seamonkey
  SeaMonkey: [
    ["mailbox:", null],
    [null, "mailbox:"],
  ],
};
