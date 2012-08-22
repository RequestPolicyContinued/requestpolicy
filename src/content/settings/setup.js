function showConfigure() {
  $('#welcome').attr('style', 'display: none');
  $('#configure').attr('style', 'display: block');
}


function handleDefaultDenyChange() {
  setAllowSameDomainBlockDisplay();
}


function setAllowSameDomainBlockDisplay() {
  if ($('#defaultallow').attr('checked')) {
    $('#allowsamedomainblock').attr('style', 'display: none');
  } else {
    $('#allowsamedomainblock').attr('style', 'display: block');
  }
//  allowsamedomainblock

}


function onload() {
  $('#showconfigure').click(showConfigure);
  $('input[name=defaultpolicy]').change(handleDefaultDenyChange);
}
