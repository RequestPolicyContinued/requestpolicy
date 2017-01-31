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

## get unique manifest.json (for example "version": "2.0.41" => "version": "2.0.42"),
#version=`grep -P '"version": "([0-9]+\.)?' src/manifest.json |  grep -oP '[0-9]+"' | awk '{ print $1 + 1 }'`
# get unique "install.rdf" em:version
version=`grep -o '[0-9]*</em:version>' $src/install.rdf | awk '{ print $1 + 1 }'`

# redirect make.sh output (optional)
# exec > $dist/$appdate-$APP-$version.log 2>&1

# copy $src/* to $build/
cp --dereference -pr $src/* $build/
cp --dereference -p README.md $build/README.md

## make $src/manifest.json unique => "version": "2.0.42"
#sed -i 's/\.[0-9]*"/\.'$version'"/' $src/manifest.json
# make "install.rdf" em:version unique
sed -i 's/[0-9]*<\/em:version>/'$version'<\/em:version>/' $build/install.rdf

# preprocess (optional)
echo "JavaScript .jsm" > $build/preprocess.txt
( cd $build
	for f in `find . -iname '*.jsm'` ; do
		preprocess --content-types-path $build/preprocess.txt $src/$f > $build/$f
#		preprocess --content-types-path $build/preprocess.txt -D LOG_ENVIRONMENT $src/$f > $build/$f
	done
	rm -f preprocess.txt
)

# make a zip, or xpi
XPI="$APP-$version~pre.xpi"
rm -f $dist/$XPI
cd $build && zip -pr $dist/$XPI *

