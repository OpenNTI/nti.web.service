#!/usr/bin/env bash
set -e
#sometimes git returns strange things...this seems to clear the bad state.
git status &> /dev/null

#check for unstaged tracked files
if ! git diff-files --quiet; then
	echo 'There are uncommitted changes. Aborting.'
	exit 1
fi

#check for staged/not committed files
if ! git diff-index --quiet --cached HEAD; then
	echo 'There are uncommitted changes. Aborting.'
	exit 1
fi

eslint --max-warnings 0 ./src || (echo "There are lint failures!" && exit 1)
jest || (echo "There are test failures!" && exit 1)

NEW=`npm version minor`
NEXT=`semver -i minor $NEW`
NEXT=$NEXT-alpha
npm version $NEXT > /dev/null
git tag -d v$NEXT > /dev/null
git push
git push origin tag v$NEW
