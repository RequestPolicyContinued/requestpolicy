/* exported run_test */
Cu.import("chrome://rpcontinued/content/lib/request-result.jsm");

function run_test() {
  "use strict";

  run_next_test();
}

//==============================================================================
// utilities
//==============================================================================

function createRequestResult() {
  return new RequestResult();
}

function policyToArrayName(policy) {
  switch (policy) {
    case "allow":
      return "matchedAllowRules";
    case "deny":
      return "matchedDenyRules";
    default:
      throw "Invalid policy";
  }
}

function addOriginRule(rr, policy) {
  let list = rr[policyToArrayName(policy)];
  list.push([{}, ["origin", {}, {}]]);
}

function addDestRule(rr, policy) {
  let list = rr[policyToArrayName(policy)];
  list.push([{}, ["origin", {}, {}]]);
}

function addOriginToDestRule(rr, policy) {
  let list = rr[policyToArrayName(policy)];
  list.push([{}, ["origin-to-dest", {}, {}, {}, {}]]);
}

//==============================================================================
// tests
//==============================================================================

//------------------------------------------------------------------------------
// resolveConflict()
//------------------------------------------------------------------------------

add_test(function() {
  // setup
  let rr = createRequestResult();
  addOriginRule(rr, "allow");
  addDestRule(rr, "deny");

  // exercise
  let rv  = rr.resolveConflict();

  // verify
  deepEqual(rv, {conflictCanBeResolved: false, shouldAllow: undefined});

  run_next_test();
});

add_test(function() {
  // setup
  let rr = createRequestResult();
  addDestRule(rr, "deny");
  addOriginToDestRule(rr, "allow");

  // exercise
  let rv  = rr.resolveConflict();

  // verify
  deepEqual(rv, {conflictCanBeResolved: true, shouldAllow: true});

  run_next_test();
});

add_test(function() {
  // setup
  let rr = createRequestResult();
  addDestRule(rr, "allow");
  addOriginToDestRule(rr, "deny");

  // exercise
  let rv  = rr.resolveConflict();

  // verify
  deepEqual(rv, {conflictCanBeResolved: true, shouldAllow: false});

  run_next_test();
});

add_test(function() {
  // setup
  let rr = createRequestResult();
  addOriginToDestRule(rr, "allow");
  addOriginToDestRule(rr, "deny");

  // exercise
  let rv  = rr.resolveConflict();

  // verify
  deepEqual(rv, {conflictCanBeResolved: false, shouldAllow: undefined});

  run_next_test();
});
