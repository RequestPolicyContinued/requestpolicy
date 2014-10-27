#!/bin/bash

MANIFEST=`dirname $0`/mozmill/addon-manifest.ini

mozmill --addon-manifests="$MANIFEST" $ARGUMENTS $@
