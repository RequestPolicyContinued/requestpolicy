
Components.utils.import("chrome://rpcontinued/content/lib/subscription.jsm");

function run_test() {
  test_1();
}

function test_1() {
  do_test_pending();

  var userSubs = new UserSubscriptions();
  userSubs.save();
  var serials = {
    'official' : {
      'embedded' : 2329159661,
      'extensions' : 0,
      'functionality' : 0,
      'mozilla' : 0,
      'sameorg' : 0,
      'trackers' : 0
    }
  };
//  var serials = {
//  };
  userSubs.update(test_1_completed, serials);
}

function test_1_completed(updateResults) {
  if (!updateResults['official']) {
    do_throw('No "official" key in updateResults.');
  }
  Logger.vardump(updateResults['official']);
  do_check_true(updateResults['official']['embedded']);
  do_check_true(false);
  do_test_finished();
  //do_check_true(objectsAreEqual(readJsonObj, exampleJsonObj));
}
