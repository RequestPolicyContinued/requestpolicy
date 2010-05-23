#!/bin/bash

##############################################################################
# A script to replace the individual locale directories in our source tree
# with the locale directories in an "X_all_locales_replaced.tar.gz" file
# downloaded from babelzilla.org. That is, the archive that has the missing
# translations replaced with the original English string.
#
# The script assumes that it is located in the the scripts/ directory, which
# is at the same level as the src/ directory in version control. It uses this
# assumption to determine where the locales are which need to be replaced.
#
# Usage: update_locales.sh RequestPolicy_all_locales_replaced.tar.gz
#
# The original tar.gz file passed as an argument is not deleted by this script.
##############################################################################

# These are the locales to replace. Don't put en-US in the list.
REPLACE_LOCALES="de eo es-MX fr ja ko-KR nl pt-BR ru-RU sv-SE tr-TR uk-UA zh-CN zh-TW"

LOCALES_DIR="`dirname $0`/../src/locale"

archive=$1

if [ ! -f "$archive" ]; then
    echo "Usage: update_locales.sh RequestPolicy_all_locales_replaced.tar.gz"
    exit 1
fi

tmpdir=`mktemp -d`

if [ ! -d "$tmpdir" ]; then
    echo "Failed creating temp directory. Exiting."
    exit 1
fi

cp $archive $tmpdir

tar -C $tmpdir -xzf $archive

for i in `echo $REPLACE_LOCALES`; do
    echo "Replacing $LOCALES_DIR/$i"
    if [ ! -d "$LOCALES_DIR/$i" ]; then
        "Locale directory $LOCALES_DIR/$i does not exist. Exiting."
        exit 1
    fi
    if [ ! -d "$tmpdir/$i" ]; then
        "Locale directory $tmpdir/$i does not exist (not in the extracted archive). Exiting."
        exit 1
    fi
    rm -rf $LOCALES_DIR/$i
    mv $tmpdir/$i $LOCALES_DIR
done

rm -rf $tmpdir

