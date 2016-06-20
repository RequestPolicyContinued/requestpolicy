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
