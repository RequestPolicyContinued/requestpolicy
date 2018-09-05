/* exported run_test */

const {JSMService} = require("bootstrap/api/services/jsm-service");
const {Runtime} = require("bootstrap/api/runtime");
const {Log} = require("lib/classes/log");
const {defer} = require("lib/utils/js-utils");

const log = new Log();
const jsmService = new JSMService(Cu);
const mozServices = jsmService.getServices();

function createRuntimeApi() {
  return new Runtime(log, mozServices.appinfo);
}

// @ts-ignore
function run_test() {
  run_next_test();
}

//
// content -> background messaging
//

[undefined, "bar", 42, {foo: "bar"}, ["foo", "bar", {baz: "baz"}]].forEach((testValue) => {
  add_test(function() {
    // setup
    const runtimeApi = createRuntimeApi();
    const backgroundOnMessage = runtimeApi.backgroundApi.onMessage;
    const contentRuntimeApi = runtimeApi.contentApi;
    let observedMessage;
    const dListenerFnCalled = defer();
    let listenerFn = (message) => {
      observedMessage = message;
      dListenerFnCalled.resolve(undefined);
      return testValue;
    };
    backgroundOnMessage.addListener(listenerFn);
    runtimeApi.startup();
    do_test_pending();

    // eslint-disable-next-line arrow-body-style
    runtimeApi.whenReady.then(() => {
      // exercise
      return contentRuntimeApi.sendMessage("foo");
    }).then((response) => {
      // verify
      Assert.strictEqual(response, testValue);
      Assert.strictEqual(observedMessage, "foo");

      // cleanup
      runtimeApi.shutdown();

      do_test_finished();
      return;
    }).catch((e) => {
      console.dir(e);
      Assert.ok(false, e);
    });

    run_next_test();
  });
});
