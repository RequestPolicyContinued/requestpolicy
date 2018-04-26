/* exported run_test */

const {Log} = require("lib/classes/log");
const log = new Log();

const {JSMService} = require("bootstrap/api/services/jsm-service");
const jsmService = new JSMService(Cu);
const mozServices = jsmService.getServices();
const prefsService = mozServices.prefs;

const {
  NetworkPredictionEnabledSetting,
} = require("bootstrap/api/privacy/network-prediction-enabled");
const { PrivacyApi } = require("bootstrap/api/privacy/privacy.module");
const { PrefBranch } = require("bootstrap/api/storage/pref-branch");
const { XPConnectService } = require("bootstrap/api/services/xpconnect-service");

function createPrivacyApi() {
  const xpconnectService = new XPConnectService();
  const rootPrefBranch = new PrefBranch(
      Ci,
      prefsService,
      xpconnectService,
      ""
  );
  const networkPredictionEnabled = new NetworkPredictionEnabledSetting(
      log, rootPrefBranch
  );
  const privacyApi = new PrivacyApi(log, networkPredictionEnabled);
  const privacy = privacyApi.backgroundApi;
  return {privacy, privacyApi, rootPrefBranch, networkPredictionEnabled};
}

// @ts-ignore
function run_test() {
  run_next_test();
}

add_test(function() {
  // setup
  const {privacy, privacyApi, rootPrefBranch} = createPrivacyApi();
  rootPrefBranch.set("network.dns.disablePrefetch", false);
  rootPrefBranch.set("network.dns.disablePrefetchFromHTTPS", false);
  rootPrefBranch.set("network.http.speculative-parallel-limit", 2);
  rootPrefBranch.set("network.predictor.enabled", true);
  rootPrefBranch.set("network.prefetch-next", true);
  privacyApi.startup();

  do_test_pending();
  privacyApi.whenReady.then(() => {
    // exercise
    privacy.network.networkPredictionEnabled.set({value: false});

    // verify
    Assert.strictEqual(rootPrefBranch.get("network.dns.disablePrefetch"), true);
    Assert.strictEqual(rootPrefBranch.get("network.dns.disablePrefetchFromHTTPS"), true);
    Assert.strictEqual(rootPrefBranch.get("network.http.speculative-parallel-limit"), 0);
    Assert.strictEqual(rootPrefBranch.get("network.predictor.enabled"), false);
    Assert.strictEqual(rootPrefBranch.get("network.prefetch-next"), false);

    // cleanup
    rootPrefBranch.reset("network.dns.disablePrefetch");
    rootPrefBranch.reset("network.dns.disablePrefetchFromHTTPS");
    rootPrefBranch.reset("network.http.speculative-parallel-limit");
    rootPrefBranch.reset("network.predictor.enabled");
    rootPrefBranch.reset("network.prefetch-next");

    do_test_finished();
    return;
  }).catch((e) => {
    console.dir(e);
    Assert.ok(false, e);
  });

  run_next_test();
});
