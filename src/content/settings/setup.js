function showConfigure() {
  document.getElementById('welcome').setAttribute('style', 'display: none');
  document.getElementById('configure').setAttribute('style', 'display: block');
}

function onload() {
  var el = document.getElementById('showconfigure');
  el.addEventListener('click', showConfigure);
}
