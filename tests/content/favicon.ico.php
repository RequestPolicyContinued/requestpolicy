<?php

$type = 'direct';

switch ($type) {
  case '404':
    header('HTTP/1.0 404 Not Found');
    exit;

  case 'redirect':
    header('Location: http://www.otherdomain.test/subdirectory/flag-gray.png');
    exit;

  case 'direct':
  default:
    header('Content-Type: image/png');
    readfile('subdirectory/flag-gray.png');
    exit;
}
