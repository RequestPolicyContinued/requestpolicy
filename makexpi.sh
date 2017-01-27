#!/bin/sh
# Public Domain.
dir=`pwd`
APP=RequestPolicy
appdate=`date +%FT%H.%M`

src=$dir/src

build=$dir/build
rm -rf $build
mkdir -p $build

dist=$dir

# make "install.rdf" em:version unique 
version=`grep -o '[0-9]*</em:version>' $src/install.rdf | awk '{ sum = $1 } END { print sum + 1 }'`
XPI="$APP-$version~pre.xpi"
if [ "$1" ]; then
	version=$1
	XPI="$XPI.xpi"
fi
sed -i 's/[0-9]*<\/em:version>/'$version'<\/em:version>/' $src/install.rdf

# redirect make.sh output (optional)
# exec > $dist/$appdate-$APP-$version.log 2>&1

# copy $src/* to $build/
cp --dereference -pr $src/* $build/
cp --dereference -p README.md $build/README.md

# preprocess (optional)
echo "JavaScript .jsm" > $build/preprocess.txt
( cd $build
	for f in `find . -iname '*.jsm'` ; do
		preprocess --content-types-path $build/preprocess.txt $src/$f > $build/$f
	done
)

# make a zip, or xpi
cd $build && zip -pr $dist/$XPI *

