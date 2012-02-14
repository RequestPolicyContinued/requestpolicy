
Components.utils.import("resource://requestpolicy/Subscription.jsm");

function run_test() {
  test_1();
}

function test_1() {
  var userSubs = new UserSubscriptions();
  userSubs.updateAll(test_1_completed);
  do_test_pending()
}

function test_1_completed(updateResults) {
  Logger.vardump(updateResults['official']);
  do_check_true(updateResults['official']['embedded']);
  do_check_true(false);
  do_test_finished();
  //do_check_true(objectsAreEqual(readJsonObj, exampleJsonObj));
}
