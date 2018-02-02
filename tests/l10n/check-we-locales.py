#!./dev_env/python/bin/python2.7

import json
import os
import sys
import re
from language_tags import tags
from termcolor import colored

def parseJSON(file):
    json_data = open(file).read()
    return json.loads(json_data)


def getLocalesList(localesDirPath):
    return os.listdir(localesDirPath)


def isValidKeyFormat(key):
    pattern = re.compile('^[A-Za-z0-9@_]+$')
    return pattern.match(key)


def isValidLanguage(dirName):
    tagStr = dirName.replace("_", "-")
    return tags(tagStr).valid()


def checkLocalesDirNames(localesDirNames, errors):
    newErrors = []
    for dirName in localesDirNames:
        tagStr = dirName.replace("_", "-")
        langTag = tags.tag(tagStr)
        if not langTag.valid:
            details = []
            for tagError in langTag.errors:
                details.append(tagError.message)

            newErrors.append({
                'msg': "'{0}' isn't a valid language tag".format(dirName),
                'details': details,
                'level': "ERROR"
            })

    errors['localesTag'] = newErrors


def checkManifest(manifest, localesDirNames, errors):
    newErrors = []
    defaultLocaleName = ""
    if ('default_locale' in manifest):
        defaultLocaleName = manifest['default_locale']
        if (defaultLocaleName not in localesDirNames):
            defaultLocaleName = ""
            newErrors.append({
                'msg': "'{0}' default locale doesn't exist in _locales dir".format(defaultLocaleName),
                'level': "ERROR"
            })
    else:
        newErrors.append({
            'msg': "'default_locale' key not found in manifest.json".format(defaultLocaleName),
            'level': "ERROR"
        })

    errors['manifest'] = newErrors
    return defaultLocaleName


def checkDefaultLocaleKeys(defaultLocale, errors):
    newErrors = []
    for key, entry in defaultLocale.iteritems():
        if not isValidKeyFormat(key):
            newErrors.append({
                'msg': "Invalid key format '{0}'".format(key),
                'level': "ERROR"
            })

        if 'message' not in entry:
            newErrors.append({
                'msg': "'message' entry not found for key '{0}'".format(key),
                'level': "ERROR"
            })
        elif not entry['message']:
            newErrors.append({
                'msg': "Empty message entry for key '{0}'".format(key),
                'level': "ERROR"
            })

        if 'description' not in entry:
            newErrors.append({
                'msg': "'description' entry not found for key '{0}'".format(key),
                'level': "WARN"
            })
        elif not entry['description']:
            newErrors.append({
                'msg': "Empty description entry for key '{0}'".format(key),
                'level': "WARN"
            })

    errors['defaultLocaleKeys'] = newErrors
    return defaultLocale


def compareToDefaultLocale(locale, localeName, defaultLocale, errors):
    newErrors = []
    defaultKeys = list(defaultLocale.keys())
    remainingKeys = list(defaultLocale.keys())

    for key, entry in locale.iteritems():
        if key not in defaultKeys:
            newErrors.append({
                'msg': "Key '{0}' doesn't exist in default locale".format(key),
                'level': "WARN"
            })
        else:
            remainingKeys.remove(key)

        if 'message' not in entry:
            newErrors.append({
                'msg': "'message' entry not found for key '{0}'".format(key),
                'level': "ERROR"
            })
        elif not entry['message']:
            newErrors.append({
                'msg': "Empty message entry for key '{0}'".format(key),
                'level': "ERROR"
            })

        if 'description' not in entry:
            newErrors.append({
                'msg': "'description' entry not found for key '{0}'".format(key),
                'level': "WARN"
            })
        elif not entry['description']:
            newErrors.append({
                'msg': "Empty description entry for key '{0}'".format(key),
                'level': "WARN"
            })

    ignoredKeys = ["extensionName", "allow_accesskey", "addRule_accesskey",
    "deny_accesskey", "more_accesskey"]
    for key in ignoredKeys:
        if key in remainingKeys:
            remainingKeys.remove(key)

    if len(remainingKeys) > 0:
        missingLabel = ", ".join(remainingKeys)
        newErrors.append({
            'msg': "Missing keys: {0}".format(missingLabel),
            'level': "WARN"
        })

    errors['locale_' + localeName] = newErrors


def printErrors(errors):
    errorLabels = {
        'localesTag': "Checking locales directory names failed:",
        'manifest': "Checking manifest failed:",
        'defaultLocaleKeys': "Checking default locale keys failed:",
        'locale_': "Checking locale '{0}' failed:"
    }

    errorNum = 0
    warnNum = 0
    otherNum = 0

    for key, errorList in errors.iteritems():
        if len(errorList) > 0:
            print("")
            label = key
            if key in errorLabels:
                label = errorLabels[key]
            elif key.startswith("locale_"):
                localeName = key.replace("locale_", "", 1)
                label = errorLabels['locale_'].format(localeName)
            print(label)
            for e in errorList:
                msg = "\t[{0}] {1}".format(e['level'], e['msg'])
                if e['level'] == "ERROR":
                    errorNum += 1
                    print(colored(msg, 'red'))
                elif e['level'] == "WARN":
                    warnNum += 1
                    print(colored(msg, 'yellow'))
                else:
                    otherNum += 1
                    print(colored(msg, 'yellow'))
                if 'details' in e and len(e['details']) > 0:
                    print("\tDetails:")
                    for d in e['details']:
                        print("\t\t- {0}".format(d))

    if errorNum or warnNum or otherNum:
        summary = "Found {0} errors, {1} warnings and {2} other things".format(errorNum, warnNum, otherNum)
        color = "yellow"
        if errorNum > 0:
            color = "red"
        print("")
        print(colored(summary, color))
    else:
        print(colored("Checked locales successfully", 'green'))

    return {'errors': errorNum, 'warnings': warnNum, 'others': otherNum}


def main():
    localesDir = "src/conditional/webextension/_locales"
    manifestPath = "src/conditional/webextension/manifest.json"

    errors = {}
    manifest = parseJSON(manifestPath)
    localesDirNames = getLocalesList(localesDir)

    checkLocalesDirNames(localesDirNames, errors)
    defaultLocaleName = checkManifest(manifest, localesDirNames, errors)

    if defaultLocaleName:
        path = "{0}/{1}/messages.json"
        defaultLocale = parseJSON(path.format(localesDir, defaultLocaleName))
        checkDefaultLocaleKeys(defaultLocale, errors)
        for localeName in localesDirNames:
            if localeName != defaultLocaleName:
                locale = parseJSON(path.format(localesDir, localeName))
                compareToDefaultLocale(locale, localeName, defaultLocale, errors)

    summary = printErrors(errors)
    if summary['errors'] > 0:
        return 1
    else:
        return 0

if __name__ == "__main__":
    sys.exit(main())
