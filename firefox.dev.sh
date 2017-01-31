#!/bin/bash
# firefox_date=`date +%FT%H.%M`
mkdir -p firefox/dev
firefox -no-remote -profile ./firefox/dev $* > './firefox/Mozilla Firefox.dev.log' 2>&1 &
