/* global $, window */
/* exported common, WinEnv, elManager, $id, $str */

var {common, WinEnv, elManager, $id, $str} = (function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {StringUtils} = importModule("lib/utils/strings");
  var {Environment, ProcessEnvironment} = importModule("lib/environment");

  //============================================================================

  // create a new Environment for this window
  var WinEnv = new Environment(ProcessEnvironment, "WinEnv");
  // The Environment has to be shut down when the content window gets unloaded.
  WinEnv.shutdownOnUnload(window);
  // start up right now, as there won't be any startup functions
  WinEnv.startup();
  var elManager = WinEnv.elManager;

  var $id = window.document.getElementById.bind(window.document);

  var COMMON_STRINGS = [
    "preferences",
    "managePolicies",
    "about",
    "help",
    "basic",
    "advanced"
  ];

  var $str = StringUtils.$str;

  var common = {};

  /**
   * Get a string representation of an endpoint (origin or dest) specification.
   *
   * The following list shows a mapping of the possible endpoint specs
   * to the corresponding string representation. Each endpoint spec contains at
   * least one of the parts "scheme", "host" and "port". The list shows the
   * strings by example: scheme "http"; host "www.example.com"; port "80".
   *
   * - s__: `scheme "http"`
   * - _h_: `www.example.com`
   * - __p: `*://*:80`
   * - sh_: `http://www.example.com`
   * - s_p: `http://*:80`
   * - _hp: `*://www.example.com:80`
   * - shp: `http://www.example.com:80`
   *
   * TODO: remove code duplication with menu.js
   */
  common.ruleDataPartToDisplayString = function(ruleDataPart) {
    if (ruleDataPart.s && !ruleDataPart.h && !ruleDataPart.port) {
      // Special case: Only a scheme is specified.
      //               The result string will be `scheme "..."`.
      // Background info: The string could be `http:*`, but this could however
      //                  be confused with `*://http:*`. The string `http://*`
      //                  wouldn't be correct for all cases, since there are
      //                  URIs _without_ a host.
      return "scheme \"" + ruleDataPart.s + "\"";
    }
    var str = "";
    if (ruleDataPart.s || ruleDataPart.port) {
      str += ruleDataPart.s || "*";
      str += "://";
    }
    str += ruleDataPart.h || "*";
    if (ruleDataPart.port) {
      str += ":" + ruleDataPart.port;
    }
    // TODO: path
    return str;
  };

  common.localize = function(stringNames) {
    stringNames.forEach(function(name) {
      $("[data-string=\"" + name + "\"]").each(function() {
        $(this).text($str(name));
      });
    });
  };

  $(function() {
    common.localize(COMMON_STRINGS);
  });

  return {
    common: common,
    WinEnv: WinEnv,
    elManager: elManager,
    $id: $id,
    $str: $str
  };
}());
