<?php
$pre_path = isset($_GET['pre_path']) ? $_GET['pre_path'] : 'http://www.otherdomain.test/';
$path = isset($_GET['path']) ? $_GET['path'] : '';
?>
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body onload="document.location = '<?=$pre_path?><?=$path?>'">
  <p>
    This page wants to redirect to
    <a href="<?=$pre_path?><?=$path?>">this URL</a>.
  <p>
</body>
</html>
