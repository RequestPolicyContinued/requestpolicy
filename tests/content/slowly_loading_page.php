<?php

function ms2str($n_milliseconds) {
    return $n_milliseconds . '&#8239;ms';
}

if (isset($_GET['load_duration'])) {
    $load_duration = (int) $_GET['load_duration'];
} else {
    $load_duration = 300;
}

?>

<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Slowly loading page</title>
</head>
<body>

<?php

echo '
<p style="margin: 2em">
  This page should take at least ' . ms2str($load_duration) . '
  to finish loading.
</p>

<ul>';

$initial_time = microtime(true);
do {
    usleep(500); // sleep 0.5ms
    $time_difference = (microtime(true) - $initial_time) * 1000;
    echo '<li>Time passed: ' . ms2str($time_difference) . '</li>';
} while ($time_difference < $load_duration);

echo '</ul>';

?>

</body>
</html>
