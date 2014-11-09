### RequestPolicy Continued ChangeLog

Note: ChangeLogs for the source code and unit tests, both not relevant for
      users, you can find in the dedicated subdirectories.

#### Version 1.0.beta8
* new features
  * Changes to the `Manage Policies` page, thanks to @chrisbura (#459)
    * changes to the style (form and list prettified. removed iframe.)
    * The list now includes temporary rules and subscription rules.
  * the redirect notification now shows a "more" button, just like RP v0.5 does.
    (#468, 48364cd)
  * the "auto reload" option from RP v0.5 is now available (#466)
  * ensure that all preference tabs that might be open *always* show the
    currently valid preference. Each tab automatically refreshes if anything is
    changed. Also the list in `yourpolicy.html`, it gets updated automatically
    when rules are added or removed.
  * added information to the "origin" and "other origins" entries in the menu
    (446e54b)
    * the number of requests is displayed.
    * a flag in front of the entries will indicate whether requests have been
      blocked specific for that origin.
  * images of blacklisted domains are now not displayed at all (no
    placeholders), thanks to @SkySkimmer (pull request #506, closes #304)
  * Subscriptions are now downloaded from
    https://github.com/RequestPolicyContinued/subscriptions
    You are very welcome to help working on the list!
* updated translation (fr, it, lv-LV, zh-CN)
* several links to requestpolicy.com have been replaced
* bugfixes
  * The initial setup didn't appear when firefox was set to restore the previous
    session on startup (#479, dd7a707)
  * NewsFox extension: Links inside articles not working (#503, 7ceef9f)
  * temporary bugfix against some non-host URI schemes, such as `mailto`,
    `feed` and `mediasource`. RP currently cannot handle URIs not containing a
    host. Solving this cleanly is milestoned for version 1.0 stable. (#447)

#### Version 1.0.0b7 (changes since 1.0.0b3)
* forked version 1.0.0b3 from
  https://github.com/RequestPolicy/requestpolicy/tree/dev-1.0
* new features:
  * icons added to the destinations list of the menu.
    The new icons are: a question mark, an "allowed" sign and a "denied" sign.
    A question mark means that the default policy applied for that destination.
  * The number of requests to a destination can be displayed in the menu.
    This depends on the boolean preference "menu.info.showNumRequests".
    Also duplicate requests are counted.
  * The destinations in the menu can now be sorted in different ways.
    It's possible to sort by…
    1. …the number of requests (highest number first)
    2. …the destination domain name (alphabetically)
    3. …no sorting at all (like in version 0.5.* until now)
    See commit 2d0461f.
* updated translation (zh-CN)
* bugfixes
  * flag color changes and visibility in Australis (#429, #436), on custom
    toolbars (#291) and in `about:customizing` (#436).
  * row background colors in the request log (#380)
  * clicking "View Selection Source" now works (#312, dd2b4e5)
  * URLs in the text without a surrounding `<a>` element ("text-links") now
    work. (#413, 4dfa13d)
  * fix browser UI freeze when the RP menu is closed and the page reload
    requires to send again form data. (#365, 4891c5a)
