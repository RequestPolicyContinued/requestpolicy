<?php
$pre_path = isset($_GET['pre_path']) ? $_GET['pre_path'] : 'http://www.otherdomain.test/';
$path = isset($_GET['path']) ? $_GET['path'] : '';
$delay = isset($_GET['delay']) ? $_GET['delay'] : '0';
?>
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh"
          content=" <?=$delay?>   ;  url = <?=$pre_path?><?=$path?>     " />
  </head>
  <body>

    <p>
      This page redirects to a different page using the
      <tt>&lt;meta&gt;</tt> tag with different formatting.
      The delay is <?=$delay?> seconds.
    </p>

  </body>
</html>
