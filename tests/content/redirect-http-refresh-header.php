<?php
$pre_path = isset($_GET['pre_path']) ? $_GET['pre_path'] : 'http://www.otherdomain.test/';
$path = isset($_GET['path']) ? $_GET['path'] : '';
header('Refresh: 0; url=' . $pre_path . $path);
