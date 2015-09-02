<?php
$path = isset($_GET['path']) ? $_GET['path'] : '';
header('Location: http://www.otherdomain.test/' . $path);
