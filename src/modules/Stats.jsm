/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

var EXPORTED_SYMBOLS = ['Stats'];

// The data in the StoredStats object is written to a file so that the
// information is available across sessions. This is the filename in the
// {PROFILE}/requestpolicy/ directory that is used.
const STORED_STATS_FILENAME = 'telemetry-study.json';

const TYPE_ALLOWED_SAME_HOST = 1;
const TYPE_ALLOWED_LINK_CLICK = 2;
const TYPE_ALLOWED_FORM_SUBMISSION = 3;
const TYPE_ALLOWED_RULE_ORIGIN_TO_DEST = 4;
const TYPE_ALLOWED_RULE_ORIGIN = 5;
const TYPE_ALLOWED_RULE_DEST = 6;
const TYPE_ALLOWED_RULE_TEMP_ORIGIN_TO_DEST = 7;
const TYPE_ALLOWED_RULE_TEMP_ORIGIN = 8;
const TYPE_ALLOWED_RULE_TEMP_DEST = 9;
const TYPE_DENIED = 10;

// How often to send a 'doc' event if there is anything to send.
const STATS_REPORT_INTERVAL_DOC = 10 * 60 * 1000;

const STATS_REPORT_INTERVAL_HIGH_FREQUENCY = 3600 * 1 * 1000;

const STATS_REPORT_INTERVAL_MED_FREQUENCY = 3600 * 6 * 1000;

// The low frequency report mostly serves to send stats that otherwise are only
// be sent on browser startup. For users who don't very rarely restart their
// browser, this is how we get a new report of those stats.
const STATS_REPORT_INTERVAL_LOW_FREQUENCY = 3600 * 24 * 1000;

const STATS_STORE_INTERVAL = 60 * 1000;

const PREFS_STORE_INTERVAL = 10 * 1000;

const BASE_TIME = Date.now();


Components.utils.import("resource://gre/modules/AddonManager.jsm");

Components.utils.import('resource://requestpolicy/DomainUtil.jsm');
Components.utils.import("resource://requestpolicy/FileUtil.jsm");
Components.utils.import('resource://requestpolicy/Logger.jsm');
Components.utils.import('resource://requestpolicy/Telemetry.jsm');

var rp = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
  .getService(Components.interfaces.nsIRequestPolicy).wrappedJSObject;

var unicodeConverter =
  Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
    createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

var cryptoHash = Components.classes["@mozilla.org/security/hash;1"]
  .createInstance(Components.interfaces.nsICryptoHash);


var data = {
  // * Top-level document actions
  'docs_next_id' : 1,
  'docs_domain_ids' : {},

  'doc_action_queue': [],

  // destdomain: each key is a destination domain name or IP address whose value
  // is a dict whose keys are origin domain names or IP addresses. The values of
  // those are always boolean true.
  'destdomains' : {},
  'origindomains' : {},

  // Keep track of mixed content we've already reported so that we can ignore
  // duplicates.
  'reported_mixed_content': {},

  // Keep track of non-standar ports we've already reported so that we can
  // ignore duplicates.
  'reported_nonstandard_ports': {}
};

///////////////////////////////////////////////////////////////////////////////
// General / sendEnvironment / Startup / Shutdown
///////////////////////////////////////////////////////////////////////////////

function sendEnvironment() {
  try {
    var env = {};
    env['os'] = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULRuntime).OS;
    var app = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULAppInfo);
    env['app'] = [app.name, app.version];
    Telemetry.track('env', env);
  } catch (e) {
    Logger.dump('Error in Stats::sendEnvironment: ' + e);
  }
}

TRACK_ADDON_IDS = [];
TRACK_ADDON_IDS.push("requestpolicy@requestpolicy.com"); // RequestPolicy
// Addons which we have compatibility rules for or which have known conflicts.
TRACK_ADDON_IDS.push("greasefire@skrul.com"); // GreaseFire
TRACK_ADDON_IDS.push("{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}"); // Sage-Too
TRACK_ADDON_IDS.push("{899DF1F8-2F43-4394-8315-37F6744E6319}"); // NewsFox
TRACK_ADDON_IDS.push("brief@mozdev.org"); // Brief
TRACK_ADDON_IDS.push("foxmarks@kei.com"); // Xmarks Sync (a.k.a. Foxmarks)
TRACK_ADDON_IDS.push("{203FB6B2-2E1E-4474-863B-4C483ECCE78E}"); // Norton Safe Web Lite Toolbar
TRACK_ADDON_IDS.push("{0C55C096-0F1D-4F28-AAA2-85EF591126E7}"); // Norton Toolbar (a.k.a. NIS Toolbar)
TRACK_ADDON_IDS.push("{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}"); // Norton Toolbar 2011.7.0.8
TRACK_ADDON_IDS.push("{c45c406e-ab73-11d8-be73-000a95be3b12}"); // Web Developer
TRACK_ADDON_IDS.push("{c07d1a49-9894-49ff-a594-38960ede8fb9}"); // Update Scanner
TRACK_ADDON_IDS.push("FirefoxAddon@similarWeb.com"); // SimilarWeb
TRACK_ADDON_IDS.push("{6614d11d-d21d-b211-ae23-815234e1ebb5}"); // Dr. Web Link Checker
// Related addons or addons with potential conflicts.
TRACK_ADDON_IDS.push("{d40f5e7b-d2cf-4856-b441-cc613eeffbe3}"); // Better Privacy
TRACK_ADDON_IDS.push("https-everywhere@eff.org"); // HTTPS Everywhere
TRACK_ADDON_IDS.push("{73a6fe31-595d-460b-a920-fcc0f8843232}"); // NoScript
TRACK_ADDON_IDS.push("firefox@ghostery.com"); // Ghostery
TRACK_ADDON_IDS.push("{d10d0bf8-f5b5-c8b4-a8b2-2b9879e08c5d}"); // ABP
TRACK_ADDON_IDS.push("jid1-F9UJ2thwoAm5gQ@jetpack"); // Collusion

function sendAddonsAndPlugins() {
  try {
    AddonManager.getAllAddons(function(aAddons) {
      try {
        var addons = [];
        for (var i in aAddons) {
          var addon = aAddons[i];
          if (TRACK_ADDON_IDS.indexOf(addon.id) == -1) {
            continue;
          }
          var item = {
            'id': addon.id,
            'n': addon.name,
            'v': addon.version,
            //'t': addon.type,
            'a': addon.isActive
          };
          if (addon.installDate) {
            item['i'] = addon.installDate.getTime();
          }
          addons.push(item)
        }
        Telemetry.track('addons', addons);
      } catch (e) {
        Logger.dump('Error in Stats::sendAddonsAndPlugins getAllAddons: ' + e);
      }
    });
  } catch (e) {
    Logger.dump('Error in Stats::sendAddonsAndPlugins: ' + e);
  }
}

function _getPersistentRuleCounts() {
  var counts = {'o': 0, 'o2d': 0, 'd': 0};
  for (var i in rp._allowedOrigins) {
    counts['o']++;
  }
  for (var i in rp._allowedOriginsToDestinations) {
    counts['o2d']++;
  }
  for (var i in rp._allowedDestinations) {
    counts['d']++;
  }
  return counts;
}


function _getTempRuleCounts() {
  var counts = {'o': 0, 'o2d': 0, 'd': 0};
  for (var i in rp._temporarilyAllowedOrigins) {
    counts['o']++;
  }
  for (var i in rp._temporarilyAllowedOriginsToDestinations) {
    counts['o2d']++;
  }
  for (var i in rp._temporarilyAllowedDestinations) {
    counts['d']++;
  }
  return counts;
}


function sendRuleCount() {
  try {
    Telemetry.track('rulecount', {
      'p': _getPersistentRuleCounts(),
      't': _getTempRuleCounts()
    });
  } catch (e) {
    Logger.dump('Error in Stats::sendRuleCount: ' + e);
  }
}

function sendRPPreferences() {
  try {
    var rpPrefs = {
      'uriIdentificationLevel': rp._uriIdentificationLevel,
      'log': rp.prefs.getBoolPref('log'),
      'contextMenu': rp.prefs.getBoolPref('contextMenu'),
      'autoReload': rp.prefs.getBoolPref('autoReload'),
      'indicateBlockedObjects': rp.prefs.getBoolPref('indicateBlockedObjects'),
      'startWithAllowAllEnabled': rp.prefs.getBoolPref('startWithAllowAllEnabled'),
      'prefetch_link_disableOnStartup': rp.prefs.getBoolPref('prefetch.link.disableOnStartup'),
      'prefetch_dns_disableOnStartup': rp.prefs.getBoolPref('prefetch.dns.disableOnStartup'),
      'privateBrowsingPermanentWhitelisting': rp.prefs.getBoolPref('privateBrowsingPermanentWhitelisting')
    };
    Telemetry.track('rp_prefs', rpPrefs);
  } catch (e) {
    Logger.dump('Error in Stats::sendRPPreferences: ' + e);
  }
}

function sendBrowserPreferences() {
  try {
    function getLocalePref() {
      try {
        return rp._rootPrefs.getComplexValue('general.useragent.locale',
            Components.interfaces.nsIPrefLocalizedString).data;
      } catch (e) {
        return rp._rootPrefs.getCharPref('general.useragent.locale');
      }
    }
    var browserPrefs = {
      'general_useragent_locale': getLocalePref(),
      'privacy_donottrackheader_enabled': rp._rootPrefs.getBoolPref('privacy.donottrackheader.enabled'),
      'places_history_enabled': rp._rootPrefs.getBoolPref('places.history.enabled'),
      'browser_privatebrowsing_autostart': rp._rootPrefs.getBoolPref('browser.privatebrowsing.autostart'),
      'network_cookie_cookieBehavior': rp._rootPrefs.getIntPref('network.cookie.cookieBehavior'),
      'network_cookie_lifetimePolicy': rp._rootPrefs.getIntPref('network.cookie.lifetimePolicy'),
      'privacy_sanitize_sanitizeOnShutdown': rp._rootPrefs.getBoolPref('privacy.sanitize.sanitizeOnShutdown'),
      'privacy_sanitize_timeSpan': rp._rootPrefs.getIntPref('privacy.sanitize.timeSpan'),
      'privacy_clearOnShutdown_cookies': rp._rootPrefs.getBoolPref('privacy.clearOnShutdown.cookies'),
      'privacy_clearOnShutdown_history': rp._rootPrefs.getBoolPref('privacy.clearOnShutdown.history')
    };
    Telemetry.track('browser_prefs', browserPrefs);
  } catch (e) {
    Logger.dump('Error in Stats::sendBrowserPreferences: ' + e);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Preferences
///////////////////////////////////////////////////////////////////////////////

function sendPrefChanged(pref) {
  try {
    var value;
    if (['log', 'contextMenu', 'autoReload', 'indicateBlockedObjects',
         'startWithAllowAllEnabled', 'prefetch.link.disableOnStartup',
         'prefetch.dns.disableOnStartup',
         'privateBrowsingPermanentWhitelisting'].indexOf(pref) != -1) {
      value = rp.prefs.getBoolPref(pref);
    } else if (pref == 'uriIdentificationLevel') {
      value = rp.prefs.getIntPref(pref);
    } else {
      return;
    }
    Telemetry.track('prefchanged', {'p': pref, 'v': value});
    sendRPPreferences();
  } catch (e) {
    Logger.dump('Error in Stats::sendPrefChanged: ' + e);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Top-level document actions
///////////////////////////////////////////////////////////////////////////////

const DOC_REQUEST = 1;
const DOC_MENU_OPENED = 2;
const DOC_MENU_CLOSED = 3;
const DOC_MENU_ACTION_TEMP_ALLOW_ALL_ENABLED = 4;
const DOC_MENU_ACTION_TEMP_ALLOW_ALL_DISABLED = 5;
const DOC_MENU_ACTION_TEMP_ALLOW_ORIGIN = 6;
const DOC_MENU_ACTION_TEMP_ALLOW_DEST = 7;
const DOC_MENU_ACTION_TEMP_ALLOW_ORIGIN_TO_DEST = 8;
const DOC_MENU_ACTION_ALLOW_ORIGIN = 9;
const DOC_MENU_ACTION_ALLOW_DEST = 10;
const DOC_MENU_ACTION_ALLOW_ORIGIN_TO_DEST = 11;
const DOC_MENU_ACTION_FORBID_ORIGIN = 12;
const DOC_MENU_ACTION_FORBID_DEST = 13;
const DOC_MENU_ACTION_FORBID_ORIGIN_TO_DEST = 14;
const DOC_MENU_ACTION_PREFS_OPENED = 15;
const DOC_MENU_ACTION_REQUEST_LOG_OPENED = 16;
const DOC_MENU_ACTION_REQUEST_LOG_CLOSED = 17;
const DOC_MENU_ACTION_REVOKE_TEMP_PERMISSIONS = 18;


// Note: this function is also used for the 'mixed' and 'port' events.
function _getDocsDomainId(uri) {
  try {
    var domain = DomainUtil.getDomain(uri);
  } catch (e) {
    return -1;
  }
  if (!data['docs_domain_ids'][domain]) {
    data['docs_domain_ids'][domain] = data['docs_next_id']++;
  }
  return data['docs_domain_ids'][domain];
}


function recordDocAction(uri, type, extra) {
  try {
    var action = {d: _getDocsDomainId(uri), t: type};
    if (extra) {
      action.e = extra;
    }
    action.rt = Date.now() - BASE_TIME;
    data['doc_action_queue'].push(action);
  } catch (e) {
    Logger.dump('Stats::recordDocAction error: ' + e);
  }
}


function sendDocs() {
  try {
    var props = data['doc_action_queue'];
    data['doc_action_queue'] = [];
    if (props.length == 0) {
      return;
    }
    Telemetry.track('docs', props);
  } catch (e) {
    Logger.dump('Stats::sendDocs error: ' + e);
  }
}


///////////////////////////////////////////////////////////////////////////////
// Preferences window actions
///////////////////////////////////////////////////////////////////////////////

const PREF_WINDOW_LOADED = 1;
const PREF_WINDOW_ALLOW_ORIGIN = 2;
const PREF_WINDOW_ALLOW_DEST = 3;
const PREF_WINDOW_ALLOW_ORIGIN_TO_DEST = 4;
const PREF_WINDOW_FORBID_ORIGIN = 5;
const PREF_WINDOW_FORBID_DEST = 6;
const PREF_WINDOW_FORBID_ORIGIN_TO_DEST = 7;
const PREF_WINDOW_IMPORT = 8;
const PREF_WINDOW_EXPORT = 9;
const PREF_WINDOW_CLOSED = 10;

function sendPrefWindow(type, extra) {
  try {
    var props = {t: type};
    if (extra) {
      props.e = extra;
    }
    Telemetry.track('prefwin', props);
  } catch (e) {
    Logger.dump('Stats::sendPrefWindow error: ' + e);
  }
}


///////////////////////////////////////////////////////////////////////////////
// Requests - general
///////////////////////////////////////////////////////////////////////////////

/*
 * Data we use to figure out how many origins per dest and how many dests per
 * origin.
 */
function recordEdges(origin, dest) {
  var originDomain = DomainUtil.getDomain(origin);
  var destDomain = DomainUtil.getDomain(dest);
  if (originDomain == destDomain) {
    return;
  }

  if (!data['destdomains'][destDomain]) {
    data['destdomains'][destDomain] = {};
  }
  if (!data['destdomains'][destDomain][originDomain]) {
    data['destdomains'][destDomain][originDomain] = true;
  }

  if (!data['origindomains'][originDomain]) {
    data['origindomains'][originDomain] = {};
  }
  if (!data['origindomains'][originDomain][destDomain]) {
    data['origindomains'][originDomain][destDomain] = true;
  }

}

NSICONTENTPOLICY_TYPE_DOCUMENT = 6;

/*
 * Data on http requests from https documents.
 */
function sendInsecureMixedContent(origin, dest, contentType) {
  var originScheme = DomainUtil.getUriObject(origin).scheme;
  var destScheme = DomainUtil.getUriObject(dest).scheme;

  if (originScheme == 'https' && destScheme == 'http' &&
      contentType != NSICONTENTPOLICY_TYPE_DOCUMENT) {

    var mixed = {
      t: contentType,
      o: _getDocsDomainId(origin),
      d: _getDocsDomainId(dest)
    };
    // Ignore duplicates.
    var reported = data['reported_mixed_content'];
    if (reported[mixed.o] &&
        reported[mixed.o][mixed.d] &&
        reported[mixed.o][mixed.d][mixed.t]) {
      return;
    }
    reported[mixed.o] = reported[mixed.o] || {};
    reported[mixed.o][mixed.d] = reported[mixed.o][mixed.d] || {};
    reported[mixed.o][mixed.d][mixed.t] = reported[mixed.o][mixed.d][mixed.t] || {};

    Telemetry.track('mixed', mixed);
  }
}


/*
 * Data about requests to non-standard ports.
 */
function sendNonStandardPorts(origin, dest, contentType) {
  var originUriObj = DomainUtil.getUriObject(origin);
  var destUriObj = DomainUtil.getUriObject(dest);
  var originPort = originUriObj.port;
  var destPort = destUriObj.port;

  // Default ports for a given protocol will be -1.
  if (originPort == -1 && destPort == -1) {
    return;
  }

  // If they're the same non-standard port, only report it if it's a top-level
  // document load. We don't want every single request from a page on a
  // non-standard port to trigger an event.
  if (originPort == destPort && contentType != NSICONTENTPOLICY_TYPE_DOCUMENT) {
    return;
  }

  var props = {
    t: contentType,
    o: _getDocsDomainId(origin),
    d: _getDocsDomainId(dest),
    o_s: originUriObj.scheme,
    d_s: destUriObj.scheme,
    o_nsp: originPort != -1,
    d_nsp: destPort != -1
  };

  // Ignore duplicates.
  var key = props.o + '-' + props.d + '-' + props.t + '-' + props.o_s + '-' +
      props.d_s + '-' + props.o_nsp + '-' + props.d_nsp;
  if (data['reported_nonstandard_ports'][key]) {
    return;
  }
  data['reported_nonstandard_ports'][key] = true;

  Telemetry.track('port', props);
}

///////////////////////////////////////////////////////////////////////////////

// A comparison function for sort().
function numeric(a, b) {
  return a - b;
}

function sendRules() {
  try {
    Telemetry.track('rules', ruleData.rules);
  } catch (e) {
    Logger.dump('Stats.sendRules error: ' + e);
  }
}


function sendTempRules() {
  try {
    Telemetry.track('temprules', ruleData.temprules);
  } catch (e) {
    Logger.dump('Stats.sendTempRules error: ' + e);
  }
}


function sendEdges() {
  try {
    var edges = {'o-per-d': [], 'd-per-o': []};

    for (var dest in data['destdomains']) {
      var count = 0;
      for (var origin in data['destdomains'][dest]) {
        count++;
      }
      edges['o-per-d'].push(count);
    }

    for (var origin in data['origindomains']) {
      //Logger.dump('origindomains origin: ' + origin);
      var count = 0;
      for (var dest in data['origindomains'][origin]) {
        count++;
      }
      edges['d-per-o'].push(count);
    }

    edges['o-per-d'].sort(numeric);
    edges['d-per-o'].sort(numeric);
    Telemetry.track('edges', edges);
  } catch (e) {
    Logger.dump('Stats.edges error: ' + e);
  }
}

///////////////////////////////////////////////////////////////////////////////

// args = [aContentType, dest, origin, aContext, aMimeTypeGuess, aExtra]

function handleStatsShouldLoadCall(type, args) {
  try {
    var contentType = args[0];
    var dest = args[1];
    var origin = args[2];

    recordEdges(origin, dest);
    sendInsecureMixedContent(origin, dest, contentType);
    sendNonStandardPorts(origin, dest, contentType);
  } catch (e) {
    Logger.dump('Stats::handleStatsShouldLoadCall error: ' + e);
  }
}

/**
 * Statistics gathering.
 */
var Stats = {

  reportStatsHighFrequency : function() {
    sendTempRules();
    sendEdges();
  },

  reportStatsMedFrequency : function() {
    sendRules();
  },

  // Reminder: Low frequency stats aren't sent on browser shutdown.
  reportStatsLowFrequency : function() {
    sendBrowserPreferences();
    sendAddonsAndPlugins();
  },

  reportQueuedDocActions : function() {
    sendDocs();
  },

  browserStarted : function() {
    Telemetry.track('browser_started');
    ruleData.loadFromFile();
    ruleData.importExistingRules();
    this.reportStatsLowFrequency();
    sendEnvironment();
    sendRuleCount();
    sendRPPreferences();
  },

  consentGranted : function() {
    Telemetry.track('consent_granted');
    ruleData.reset();
    ruleData.importExistingRules();
    this.reportStatsHighFrequency();
    this.reportStatsMedFrequency();
    this.reportStatsLowFrequency();
    sendEnvironment();
    sendRuleCount();
    sendRPPreferences();
  },

  consentRevoked : function() {
    this.reportQueuedDocActions();
    Telemetry.track('consent_revoked');
  },

  prefChanged : function(pref) {
    sendPrefChanged(pref);
  },

  requestedTopLevelDocument : function(uri) {
    recordDocAction(uri, DOC_REQUEST);
  },

  menuOpened : function(uri, blockedDestCount, allowedDestCount, otherOriginCount) {
    recordDocAction(
      uri, DOC_MENU_OPENED,
      {'bd': blockedDestCount, 'ad': allowedDestCount, 'oo': otherOriginCount});
  },

  menuClosed : function(uri) {
    recordDocAction(uri, DOC_MENU_CLOSED);
  },

  menuActionTempAllowAllEnabled : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_TEMP_ALLOW_ALL_ENABLED);
  },

  menuActionTempAllowAllDisabled : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_TEMP_ALLOW_ALL_DISABLED);
  },

  menuActionAllowOrigin : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_ALLOW_ORIGIN);
  },

  menuActionAllowDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_ALLOW_DEST);
  },

  menuActionAllowOriginToDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_ALLOW_ORIGIN_TO_DEST);
  },

  menuActionTempAllowOrigin : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_TEMP_ALLOW_ORIGIN);
  },

  menuActionTempAllowDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_TEMP_ALLOW_DEST);
  },

  menuActionTempAllowOriginToDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_TEMP_ALLOW_ORIGIN_TO_DEST);
  },

  menuActionForbidOrigin : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_FORBID_ORIGIN);
  },

  menuActionForbidDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_FORBID_DEST);
  },

  menuActionForbidOriginToDest : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_FORBID_ORIGIN_TO_DEST);
  },

  menuActionPrefsOpened : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_PREFS_OPENED);
  },

  menuActionRequestLogOpened : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_REQUEST_LOG_OPENED);
  },

  menuActionRequestLogClosed : function(uri) {
    recordDocAction(uri, DOC_MENU_ACTION_REQUEST_LOG_CLOSED);
  },

  menuActionRevokeTempPerms : function(uri) {
    sendRuleCount();
    recordDocAction(uri, DOC_MENU_ACTION_REVOKE_TEMP_PERMISSIONS);
  },

  prefWindowLoaded : function() {
    sendPrefWindow(PREF_WINDOW_LOADED);
  },

  prefWindowClosed : function(extra) {
    sendPrefWindow(PREF_WINDOW_CLOSED, extra);
  },

  prefWindowAllowOrigin : function() {
    sendPrefWindow(PREF_WINDOW_ALLOW_ORIGIN);
  },

  prefWindowAllowDest : function() {
    sendPrefWindow(PREF_WINDOW_ALLOW_DEST);
  },

  prefWindowAllowOriginToDest : function() {
    sendPrefWindow(PREF_WINDOW_ALLOW_ORIGIN_TO_DEST);
  },

  prefWindowForbidOrigin : function() {
    sendPrefWindow(PREF_WINDOW_FORBID_ORIGIN);
  },

  prefWindowForbidDest : function() {
    sendPrefWindow(PREF_WINDOW_FORBID_DEST);
  },

  prefWindowForbidOriginToDest : function() {
    sendPrefWindow(PREF_WINDOW_FORBID_ORIGIN_TO_DEST);
  },

  prefWindowImport : function() {
    sendPrefWindow(PREF_WINDOW_IMPORT);
  },

  prefWindowExport : function() {
    sendPrefWindow(PREF_WINDOW_EXPORT);
  },

  allowedSameHost : function(args) {
    handleStatsShouldLoadCall(TYPE_ALLOWED_SAME_HOST, args);
  },

  // For now, we don't have any link click or form submission data we're
  // tracking. We might want to track how many cross-site form submissions there
  // are.
  allowedLinkClick : function(args) {
    //handleStatsShouldLoadCall(TYPE_ALLOWED_LINK_CLICK, args);
  },
  allowedFormSubmission : function(args) {
    //handleStatsShouldLoadCall(TYPE_ALLOWED_FORM_SUBMISSION, args);
  },

  _ruleMatched : function(args, originIdent, destIdent, temp) {
    try {
      ruleData.ruleMatched(args, originIdent, destIdent, temp);
    } catch (e) {
      Logger.dump('error in _ruleMatched: ' + e);
    }
  },

  allowedByOriginToDest : function(args, originIdent, destIdent) {
    this._ruleMatched(args, originIdent, destIdent);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_ORIGIN_TO_DEST, args);
  },

  allowedByOrigin : function(args, originIdent) {
    this._ruleMatched(args, originIdent, null);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_ORIGIN, args);
  },

  allowedByDest : function(args, destIdent) {
    this._ruleMatched(args, null, destIdent);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_DEST, args);
  },

  tempAllowedByOriginToDest : function(args, originIdent, destIdent) {
    this._ruleMatched(args, originIdent, destIdent, true);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_TEMP_ORIGIN_TO_DEST, args);
  },

  tempAllowedByOrigin : function(args, originIdent) {
    this._ruleMatched(args, originIdent, null, true);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_TEMP_ORIGIN, args);
  },

  tempAllowedByDest : function(args, destIdent) {
    this._ruleMatched(args, null, destIdent, true);
    handleStatsShouldLoadCall(TYPE_ALLOWED_RULE_TEMP_DEST, args);
  },

  denied : function(args) {
    handleStatsShouldLoadCall(TYPE_DENIED, args);
  },

  // Rule creation/deletion

  _ruleAdded: function(originIdent, destIdent, temp) {
    try {
      sendRuleCount();
      ruleData.ruleAdded(originIdent, destIdent, temp);
    } catch (e) {
      Logger.dump('error in _ruleAdded: ' + e);
    }
  },

  ruleAddedOrigin: function(originIdent) {
    this._ruleAdded(originIdent, null);
  },

  ruleAddedDest: function(destIdent) {
    this._ruleAdded(null, destIdent);
  },

  ruleAddedOriginToDest: function(originIdent, destIdent) {
    this._ruleAdded(originIdent, destIdent);
  },

  ruleAddedTempOrigin: function(originIdent) {
    this._ruleAdded(originIdent, null, true);
  },

  ruleAddedTempDest: function(destIdent) {
    this._ruleAdded(null, destIdent, true);
  },

  ruleAddedTempOriginToDest: function(originIdent, destIdent) {
    this._ruleAdded(originIdent, destIdent, true);
  },

  _ruleRemoved: function(originIdent, destIdent, temp) {
    try {
      sendRuleCount();
      ruleData.ruleRemoved(originIdent, destIdent, temp);
    } catch (e) {
      Logger.dump('error in _ruleRemoved: ' + e);
    }
  },

  ruleRemovedOrigin: function(originIdent) {
    this._ruleRemoved(originIdent, null);
  },

  ruleRemovedDest: function(destIdent) {
    this._ruleRemoved(null, destIdent);
  },

  ruleRemovedOriginToDest: function(originIdent, destIdent) {
    this._ruleRemoved(originIdent, destIdent);
  },

  ruleRemovedTempOrigin: function(originIdent) {
    this._ruleRemoved(originIdent, null, true);
  },

  ruleRemovedTempDest: function(destIdent) {
    this._ruleRemoved(null, destIdent, true);
  },

  ruleRemovedTempOriginToDest: function(originIdent, destIdent) {
    this._ruleRemoved(originIdent, destIdent, true);
  },

  deleteFile : function() {
    ruleData.deleteFile();
  },

  saveFile : function() {
    ruleData.saveToFile();
  }
};


function hourTimestamp() {
  // Timestamp in seconds rounded down to the nearest hour.
  return Math.floor(Date.now() / 1000 / 3600) * 3600;
}

// return the two-digit hexadecimal code for a byte
function toHexString(charCode) {
  return ('0' + charCode.toString(16)).slice(-2);
}

function getHash(str) {
  unicodeConverter.charset = 'UTF-8';
  var result = {};
  var data = unicodeConverter.convertToByteArray(str, result);
  cryptoHash.init(cryptoHash.MD5);
  cryptoHash.update(data, data.length);
  var hash = cryptoHash.finish(false);
  // We don't need 128 bits. Let's take 32. Very roughly, that should give us
  // a 0.01% chance of two strings out of a thousand having the same key.
  hash = hash.slice(-4);
  return [toHexString(hash.charCodeAt(i)) for (i in hash)].join('');
}

function isValidIdent(ident) {
  if (!DomainUtil.isValidUri(ident)) {
    ident = 'http://' + ident;
  }
  // If it's still not valid as a uri, it can't be a valid ident.
  if (!DomainUtil.isValidUri(ident)) {
    return false;
  }
  // If it has a path or a scheme like "http:/" (so we had prepended one above),
  // it's not valid.
  if (DomainUtil.getUriObject(ident).prePath != ident) {
    return false;
  }
  return true;
}

function generateSalt() {
  const length = 32; // bytes
  var buffer = '';
  var prng = Components.classes['@mozilla.org/security/random-generator;1'];
  var bytes =  prng.getService(Components.interfaces.nsIRandomGenerator)
      .generateRandomBytes(length, buffer);
  var salt = [toHexString(bytes[i]) for (i in bytes)].join('');
  return salt;
}


var ruleData = {

  salt: null,
  keys: [],
  tempkeys: [], // not stored
  rules: {},
  temprules: {}, // not stored

  reset: function() {
    this.salt = generateSalt();
    this.keys = [];
    this.rules = {};
    this.tempkeys = [];
    this.temprules = {};
  },

  initialize : function(data) {
    if (data.salt && data.keys && data.rules) {
      this.salt = data.salt;
      this.keys = data.keys;
      this.rules = data.rules;
    } else {
      this.salt = generateSalt();
    }
  },

  _getKeyID : function(string, temp) {
    // Sanity check: it would be bad if a bug caused the salt to not be set.
    if (!this.salt) {
      throw 'Invalid salt: ' + this.salt;
    }
    var hash = getHash(this.salt + string);
    var keys = temp ? this.tempkeys : this.keys;
    if (keys.indexOf(hash) == -1) {
      keys.push(hash);
    }
    return hash;
  },

  importExistingRules: function() {
    try {
      for (var originIdent in rp._allowedOrigins) {
        this._getRuleRecord(originIdent, null);
      }
      for (var destIdent in rp._allowedDestinations) {
        this._getRuleRecord(null, destIdent);
      }
      for (var combinedIdent in rp._allowedOriginsToDestinations) {
        var parts = combinedIdent.split('|');
        var originIdent = parts[0];
        var destIdent = parts[1];
        this._getRuleRecord(originIdent, destIdent);
      }

      for (var originIdent in rp._temporarilyAllowedOrigins) {
        this._getRuleRecord(originIdent, null, true);
      }
      for (var destIdent in rp._temporarilyAllowedDestinations) {
        this._getRuleRecord(null, destIdent, true);
      }
      for (var combinedIdent in rp._temporarilyAllowedOriginsToDestinations) {
        var parts = combinedIdent.split('|');
        var originIdent = parts[0];
        var destIdent = parts[1];
        this._getRuleRecord(originIdent, destIdent, true);
      }
    } catch (e) {
      Logger.dump('error importing existing rules into stats data: ' + e);
    }
  },

  _generateRuleRecord : function(originIdent, destIdent, temp) {
    var record = {};
    if (isSuggestedRule(originIdent, destIdent)) {
        record.sg = true;
    }

    if (originIdent) {
      record.o = {};
      if (!isValidIdent(originIdent)) {
        record.o.inv = true;
      } else {
        if (DomainUtil.isValidUri(originIdent)) {
          var useOrigin = originIdent;
          record.o.s = true; // includes scheme
          // Non-standard port
          record.o.nsp = DomainUtil.getUriObject(useOrigin).port != -1;
        } else {
          useOrigin = 'http://' + originIdent;
          record.o.s = false; // does not include scheme
        }
        if (DomainUtil.getHost(useOrigin) == DomainUtil.getDomain(useOrigin)) {
          if (DomainUtil.isIPAddress(DomainUtil.getUriObject(useOrigin).host)) {
            record.o.ht = 'a'; // address
          } else {
            record.o.ht = 'd'; // registered domain or non-dotted hostname
          }
        } else {
          record.o.ht = 's'; // subdomain
        }

        var originIdentKey = this._getKeyID(originIdent);
        var originHostKey = this._getKeyID(DomainUtil.getHost(useOrigin), temp);
        var originDomainKey = this._getKeyID(DomainUtil.getDomain(useOrigin), temp);
        if (record.o.ht != 'a' && originDomainKey != originIdentKey) {
          record.o.dk = originDomainKey;
        }
        if (record.o.ht == 'a' ||
            (originHostKey != originIdentKey && originHostKey != originDomainKey)) {
          record.o.hk = originHostKey;
        }
      }
    }

    if (destIdent) {
      record.d = {};
      if (!isValidIdent(destIdent)) {
        record.d.inv = true;
      } else {
        if (DomainUtil.isValidUri(destIdent)) {
          var useDest = destIdent;
          record.d.s = true; // includes scheme
          // Non-standard port
          record.d.nsp = DomainUtil.getUriObject(useDest).port != -1;
        } else {
          useDest = 'http://' + destIdent;
          record.d.s = false; // does not include scheme
        }
        if (DomainUtil.getHost(useDest) == DomainUtil.getDomain(useDest)) {
          if (DomainUtil.isIPAddress(DomainUtil.getUriObject(useDest).host)) {
            record.d.ht = 'a'; // address
          } else {
            record.d.ht = 'd'; // registered domain or non-dotted hostname
          }
        } else {
          record.d.ht = 's'; // subdomain
        }

        var destIdentKey = this._getKeyID(destIdent);
        var destHostKey = this._getKeyID(DomainUtil.getHost(useDest), temp);
        var destDomainKey = this._getKeyID(DomainUtil.getDomain(useDest), temp);
        if (record.d.ht != 'a' && destDomainKey != destIdentKey) {
          record.d.dk = destDomainKey;
        }
        if (record.d.ht == 'a' ||
            (destHostKey != destIdentKey && destHostKey != destDomainKey)) {
          record.d.hk = destHostKey;
        }
      }
    }

    return record;
  },

  _getRuleRecord : function(originIdent, destIdent, temp) {
    var rules = temp ? this.temprules : this.rules;

    var originKey = originIdent ? this._getKeyID(originIdent, temp) :  '';
    var destKey = destIdent ? this._getKeyID(destIdent, temp) : '';
    var ruleID = originKey + '|' + destKey;

    if (!rules[ruleID]) {
      rules[ruleID] = this._generateRuleRecord(originIdent, destIdent, temp);
    }
    return rules[ruleID];
  },

  ruleAdded: function(originIdent, destIdent, temp) {
    var record = this._getRuleRecord(originIdent, destIdent, temp);
    if (!record['h']) {
        record['h'] = [];
    }
    record['h'].push(['c', hourTimestamp()]);
  },

  ruleRemoved: function(originIdent, destIdent, temp) {
    var record = this._getRuleRecord(originIdent, destIdent, temp);
    if (!record['h']) {
        record['h'] = [];
    }
    record['h'].push(['d', hourTimestamp()]);
  },

  ruleMatched: function(args, originIdent, destIdent, temp) {
    var record = this._getRuleRecord(originIdent, destIdent, temp);
    record['l'] = hourTimestamp();
    if (!record.t) {
      record.t = [];
    }
    if (record.t.indexOf(args[0]) == -1) {
      record.t.push(args[0]);
    }
  },

  loadFromFile : function() {
    try {
      var file = FileUtil.getRPUserDir();
      file.appendRelativePath(STORED_STATS_FILENAME);
      var str = FileUtil.fileToString(file);
      if (!str) {
        throw 'stats file is empty';
      }
      var data = JSON.parse(str);
    } catch (e) {
      Logger.dump('Unable to load stored stats.');
      data = {};
    }
    this.initialize(data);
  },

  saveToFile : function() {
    if (!Telemetry.getEnabled() || Telemetry.isPastEndDate()) {
      return;
    }
    var data = {
      salt: this.salt,
      keys: this.keys,
      rules: this.rules
    };

    try {
      var file = FileUtil.getRPUserDir();
      file.appendRelativePath(STORED_STATS_FILENAME);
      var str = JSON.stringify(data);
      FileUtil.stringToFile(str, file);
    } catch (e) {
      Logger.dump('Unable to save stored stats: ' + e);
    }
  },

  deleteFile : function() {
    try {
      var file = FileUtil.getRPUserDir();
      file.appendRelativePath(STORED_STATS_FILENAME);
      file.remove(false);
    } catch (e) {
      Logger.dump('Unable to delete stored stats: ' + e);
    }
  }

};


// From initialSetup.js
var rawSuggestedItems = [
   ["yahoo.com", "yimg.com"],
    ["paypal.com", "paypalobjects.com"],
    ["google.com", "googlehosted.com"], ["google.com", "gvt0.com"],
    ["google.com", "youtube.com"], ["google.com", "ggpht.com"],
    ["google.com", "gstatic.com"], ["gmail.com", "google.com"],
    ["googlemail.com", "google.com"], ["youtube.com", "ytimg.com"],
    ["youtube.com", "google.com"], ["youtube.com", "googlevideo.com"],
    ["live.com", "msn.com"], ["msn.com", "live.com"],
    ["live.com", "virtualearth.net"], ["live.com", "wlxrs.com"],
    ["hotmail.com", "passport.com"], ["passport.com", "live.com"],
    ["live.com", "hotmail.com"], ["microsoft.com", "msn.com"],
    ["microsoft.com", "live.com"], ["live.com", "microsoft.com"],
    ["facebook.com", "fbcdn.net"], ["myspace.com", "myspacecdn.com"],
    ["wikipedia.com", "wikipedia.org"], ["wikipedia.org", "wikimedia.org"],
    ["wiktionary.org", "wikimedia.org"],
    ["wikibooks.org", "wikimedia.org"],
    ["wikiversity.org", "wikimedia.org"],
    ["wikisource.org", "wikimedia.org"], ["wikinews.org", "wikimedia.org"],
    ["blogger.com", "google.com"], ["google.com", "blogger.com"],
    ["blogspot.com", "blogger.com"], ["flickr.com", "yimg.com"],
    ["flickr.com", "yahoo.com"], ["imdb.com", "media-imdb.com"],
    ["fotolog.com", "fotologs.net"], ["metacafe.com", "mcstatic.com"],
    ["metacafe.com", "mccont.com"], ["download.com", "com.com"],
    ["cnet.com", "com.com"], ["gamespot.com", "com.com"],
    ["sf.net", "sourceforge.net"], ["sourceforge.net", "fsdn.com"],
    ["mapquest.com", "mqcdn.com"], ["mapquest.com", "aolcdn.com"],
    ["mapquest.com", "aol.com"], ["twitter.com", "twimg.com"],
   ["orkut.com", "google.com"], ["orkut.com.br", "google.com"],
    ["uol.com.br", "imguol.com"], ["google.com", "orkut.com"],
   ["orkut.com", "google.com"], ["orkut.co.in", "google.com"],
    ["google.com", "orkut.com"], ["yahoo.co.jp", "yimg.jp"],
    ["sina.com.cn", "sinaimg.cn"], ["amazon.co.jp", "images-amazon.com"],
    ["amazon.co.jp", "ssl-images-amazon.com"],
    ["amazon.cn", "images-amazon.com"],
    ["amazon.cn", "ssl-images-amazon.com"], ["amazon.cn", "joyo.com"],
    ["joyo.com", "amazon.cn"], ["taobao.com", "taobaocdn.com"],
    ["163.com", "netease.com"], ["daum.net", "daum-img.net"],
    ["tudou.com", "tudouui.com"],
   ["ebay.ca", "ebaystatic.com"], ["ebay.ca", "ebay.com"],
    ["ebay.com", "ebay.ca"], ["ebay.com", "ebaystatic.com"],
    ["amazon.com", "images-amazon.com"],
    ["amazon.com", "ssl-images-amazon.com"],
    ["amazon.ca", "images-amazon.com"],
    ["amazon.ca", "ssl-images-amazon.com"], ["aol.com", "aolcdn.com"],
    ["cnn.com", "turner.com"], ["cnn.com", "cnn.net"],
    ["tagged.com", "tagstat.com"], ["comcast.net", "cimcontent.net"],
    ["weather.com", "imwx.com"], ["netflix.com", "nflximg.com"],
   ["ebay.de", "ebaystatic.com"], ["ebay.de", "ebay.com"],
    ["ebay.com", "ebay.de"], ["ebay.co.uk", "ebaystatic.com"],
    ["ebay.co.uk", "ebay.com"], ["ebay.com", "ebay.co.uk"],
    ["ebay.fr", "ebaystatic.com"], ["ebay.fr", "ebay.com"],
    ["ebay.com", "ebay.fr"], ["mail.ru", "imgsmail.ru"],
    ["amazon.de", "images-amazon.com"],
    ["amazon.de", "ssl-images-amazon.com"],
    ["amazon.co.uk", "images-amazon.com"],
    ["amazon.co.uk", "ssl-images-amazon.com"],
    ["amazon.fr", "images-amazon.com"],
    ["amazon.fr", "ssl-images-amazon.com"], ["yandex.ru", "yandex.net"],
    ["skyrock.com", "skyrock.net"], ["netlog.com", "netlogstatic.com"],
    ["rambler.ru", "rl0.ru"], ["orange.fr", "woopic.com"],
   ["ebay.com.au", "ebaystatic.com"],
    ["ebay.com.au", "ebay.com"], ["ebay.com", "ebay.com.au"]
];

var suggestedItems = [];
for (var i in rawSuggestedItems) {
  suggestedItems.push(rawSuggestedItems[i][0] + '|' + rawSuggestedItems[i][1]);
}

function isSuggestedRule(originIdent, destIdent) {
  if (!originIdent) {
    originIdent = '';
  }
  if (!destIdent) {
    destIdent = '';
  }
  return suggestedItems.indexOf(originIdent + '|' + destIdent) != -1;
}


var reportTimerDoc = Components.classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer);
reportTimerDoc.initWithCallback(
    Stats.reportQueuedDocActions, STATS_REPORT_INTERVAL_DOC,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


var reportTimerHighFrequency = Components.classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer);
reportTimerHighFrequency.initWithCallback(
    Stats.reportStatsHighFrequency, STATS_REPORT_INTERVAL_HIGH_FREQUENCY,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


var reportTimerMedFrequency = Components.classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer);
reportTimerMedFrequency.initWithCallback(
    Stats.reportStatsMedFrequency, STATS_REPORT_INTERVAL_MED_FREQUENCY,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


var reportTimerLowFrequency = Components.classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer);
reportTimerLowFrequency.initWithCallback(
    Stats.reportStatsLowFrequency, STATS_REPORT_INTERVAL_LOW_FREQUENCY,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


var statsSaveTimer = Components.classes["@mozilla.org/timer;1"].createInstance(
  Components.interfaces.nsITimer);
statsSaveTimer.initWithCallback(function() {
  ruleData.saveToFile();
}, STATS_STORE_INTERVAL, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);


var prefsSaveTimer = Components.classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer);
prefsSaveTimer.initWithCallback(function() {
  if (rp.globalEventIDChanged) {
    rp.globalEventIDChanged = false;
    rp._prefService.savePrefFile(null);
  }
}, PREFS_STORE_INTERVAL, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
