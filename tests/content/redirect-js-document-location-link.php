<?php
$pre_path = isset($_GET['pre_path']) ? $_GET['pre_path'] : 'http://www.otherdomain.test/';
$path = isset($_GET['path']) ? $_GET['path'] : '';
$link_href = "javascript:document.location = '" . $pre_path . $path . "'";
$link_href_encoded = htmlspecialchars($link_href);
?>
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body>

<p>
  The following link will redirect to another URL.
</p>

<p>
  <a href="<?=$link_href?>">
    link with href: <tt><?=$link_href_encoded?></tt>
  </a>
<p>

</body>
</html>
