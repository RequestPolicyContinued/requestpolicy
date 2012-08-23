function showConfigure() {
  $('#welcome').css('display', 'none');
  $('#configure').css('display', 'block');
}

function handleDefaultPolicyChange() {
  rpService.prefs.setBoolPref('defaultPolicy.allow',
      $('#defaultallow').prop('checked'));
  rpServiceJSObject._prefService.savePrefFile(null);
  setAllowSameDomainBlockDisplay();
  handleSubscriptionsChange();
}

function handleAllowSameDomainChange() {
  rpService.prefs.setBoolPref('defaultPolicy.allowSameDomain',
      $('#allowsamedomain').prop('checked'));
  rpServiceJSObject._prefService.savePrefFile(null);
}

function setAllowSameDomainBlockDisplay() {
  if ($('#defaultallow').prop('checked')) {
    $('#allowsamedomainblock').css('display', 'none');
  } else {
    $('#allowsamedomainblock').css('display', 'block');
  }
}

function handleSubscriptionsChange() {
  var enableSubs = $('#enablesubs').prop('checked');
  var enableAllowSubs = enableSubs && $('#defaultdeny').prop('checked');
  var enableDenySubs = enableSubs && $('#defaultallow').prop('checked');
  var subs = {
    'allow_embedded':{},
    'allow_extensions':{},
    'allow_functionality':{},
    'allow_mozilla':{},
    'allow_sameorg':{},
    'deny_trackers':{}
  };
  var userSubs = rpServiceJSObject._subscriptions;
  for (var subName in subs) {
    var subInfo = {};
    subInfo['official'] = {};
    subInfo['official'][subName] = true;
    if (enableAllowSubs && subName.indexOf('allow_') == 0 ||
        enableDenySubs && subName.indexOf('deny_') == 0) {
      userSubs.addSubscription('official', subName);
      observerService.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
          JSON.stringify(subInfo));
    } else {
      userSubs.removeSubscription('official', subName);
      observerService.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
          JSON.stringify(subInfo));
    }
  }
}

function onload() {
  // Populate the form values based on the user's current settings.
  // TODO: if this setup window is being shown due to an upgrade from 0.x, then
  // populate the form based off of the relevant 0.x settings.
  var defaultAllow = rpService.prefs.getBoolPref('defaultPolicy.allow');
  $('#defaultallow').prop('checked', defaultAllow);
  $('#defaultdeny').prop('checked', !defaultAllow);
  if (!defaultAllow) {
    $('#allowsamedomainblock').css('display', 'block');
  }
  $('#allowsamedomain').prop('checked',
      rpService.prefs.getBoolPref('defaultPolicy.allowSameDomain'));
  // Subscriptions are only simple here if we assume the user won't open the
  // setup window again after changing their individual subscriptions through
  // the preferences. So, let's assume that as the worst case is that the setup
  // page shows such a setup-page-revisiting user the subscriptions as being
  // enabled when they really aren't.

  $('#showconfigure').click(showConfigure);
  $('input[name=defaultpolicy]').change(handleDefaultPolicyChange);
  $('input[name=subscriptions]').change(handleSubscriptionsChange);
  $('#allowsamedomain').change(handleAllowSameDomainChange);
}
