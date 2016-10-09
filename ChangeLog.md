### RequestPolicyContinued ChangeLog

Note: ChangeLogs for the source code and unit tests, both not relevant for
      users, you can find in the dedicated subdirectories.

#### next version
* improvements
  * When the "allow same domain" setting is set to `false`, allow
    http:80 to https:443 if the host is the same.
  * DNS Prefetching: Besides `network.dns.disablePrefetch`, also take into
    account the `network.dns.disablePrefetchFromHTTPS` setting (#795)
* bugfixes
  * Redirections made by Add-Ons via "nsIHttpChannel.redirectTo()" are
    now intercepted, and visible in the request log. (#775)
  * new "internal request" whitelist entries (due to #783):
    * view-source CSS file (#788)
    * NoScript icon for blocked flash content (#788)
    * pluginproblem URI (#797, #788)
  * Add-on compatibility:
    * NewsFox showed a redirection notification when clicking on a
      news' title (#707)
  * Browser compatibility:
    * Firefox Accounts (#687)
  * updated translations
    * es-ES: #790
* minor changes
  * Don't change the font color in RP's context menu entry (#31).
  * Ignore clicks on `[no origin]` in the menu (#761).
  * In default-allow mode, add the menu option
    "Block all requests from <origin domain>" (#559).


#### Version 1.0.beta12.4
* bugfixes
  * compatibility with WebExtensions (#813)

#### Version 1.0.beta12.3
* bugfixes
  * The "show re-import options" button did not work on Fx48+ (#774)

#### Version 1.0.beta12.2
* bugfixes
  * some destination URIs are now recognized to be "internal" and thus
    whitelisted (#784)
    * "about:blank" -- necessary for some websites
    * "chrome://*/skin/" -- necessary for some Add-ons

#### Version 1.0.beta12.1
* bugfixes
  * The menu overlay of some Add-ons did not work; it stayed blank.

#### Version 1.0.beta12.0
* improvements
  * New preference to define a keyboard shortcut for opening the RequestLog,
    defaults to none. (#778, 5124b50)
  * Rule semantics: The scheme and host fields now accept "*" wildcards
    (0e9f13f, 977012d, #555).
* bugfixes
  * RequestPolicy did not block internal resources to websites. Obviously
    Firefox allows websites to request some internal resources. (#783, d1f6976)
* new translations
  * es-ES: #771, #772
* updated translations
  * fr: #765
  * es-MX: #769, #770


#### Version 1.0.beta11.1
* A JavaScript warning has been fixed. There's no change in
  functionality, and no bugs have been fixed.

#### Version 1.0.beta11
* improvements
  * Rules specifying both origin and destination (origin-to-dest rules)
    should have precedence over origin-only and dest-only rules
    (#491, 220a897)
  * Open MyWOT information in a new tab when the middle mouse button
    is clicked. (#456)
  * Add settings to disable "speculative pre-connections". Disable by
    default (#628, 7244262)
  * Importing old rules: detect if a wildcard needs to be added
    in front of a host or not, based on the host's base domain. (#730)
  * The menu can be opened using the context menu. (#353, 88c26b5)
  * The keyboard shortcut for opening the menu can now be disabled, or
    changed to a different combination. (#616, #460, afab797)
* other changes
  * The default policy for new installations is now "deny" again,
    just as in the 0.5.x versions.
  * The menu is positioned more intelligently (#690, d35dc9e)
  * The default keyboard shortcut to open the menu is now "Alt Shift R". (#612)
  * Experimental feature: it's possible to free some memory (#673)
* updated translation (fr)
* bugfixes
  * Importing old rules: Handle URIs without host correctly (#354)
  * Automatic import of old rules: import if and only if both
    conditions are true: (#731, 49894f6)
    - the user is upgrading RP from v0.5 to v1.0
    - the v1.0 rules file doesn't exist yet.
  * Subscription rules now apply regardless of the current default policy (#529)
  * Redirections with conflicting rules: The default policy should apply (#623)
  * Sometimes the request counter in the menu was constantly increasing
    with each page reload. (#611)
  * Sometimes the image placeholder was missing. (#747)
  * The "fragment" part of URIs was removed for the redirection
    notification. (#681)
  * E10s issues
    * The "Allow" button on the redirection notification
      bar did not always work. (#620, a168f70)
    * The redirection notification bar did not appear in
      some cases. (#722, 41366d3)
  * Add-on compatibility: KeeFox (#427, a38cc57)
  * Add-on compatibility: Enpass (#732, 566aa71)
  * Browser compatibility:
    * Firefox Accounts (#716)
    * Firefox Hello (#671, #715)


#### Version 1.0.beta10.2 (bugfix)
* The add-on did not start on the latest Firefox Nightly,
  version 44.0a1 (#719).

#### Version 1.0.beta10.1-signed
* The add-on is now signed by Mozilla. (#701) There's no change in
  functionality, and no bugs have been fixed.

#### Version 1.0.beta10
* The extension ID has changed (#609). It has to be taken care that
  different versions of RequestPolicy aren't installed at the same time.
  When upgrading from an older version there shouldn't be any problems though.
* updated translation (eu, zh-CN)


#### Version 1.0.beta9.3 (bugfix)
* it was not possible to import rules from RequestPolicy 0.5.x
  Old rules can now be imported on `about:requestpolicy?oldrules`.
* when a user was upgrading from 0.5.x, the default policy afterwards
  was "allow", but it has to be "deny".

#### Version 1.0.beta9.2 (bugfix)
* the redirection notification bar has been shown too often (#561, #630)

#### Version 1.0.beta9.1 (bugfix)
* rules with a port specified in the origin or destination haven't
  been working (#627)

#### Version 1.0.beta9
* new features
  * RPC is now a bootstrapped addon. (#489)
    This means that the addon can be installed, upgraded etc. without
    restarting firefox.
  * the RequestLog now has a RegEx filter (#537)
  * releases are now signed (#465)
  * On preferences pages, if a preference's value gets changed somewhere
    else, the preferences page is automatically updated.
    See for example commit 576d09d.
* updated translation (ja, de)
* bugfixes
  * bugs regarding requests with an origin and/or destination
    without a host:
    - The request log did not show such requests; now it does.
    - Such requests have always been rejected until the workaround
      introduced in beta8. This bug has now been fixed, so the
      workaround has been removed. (#447)
      In fact a user can now define rules which specify only a "scheme",
      no "host". Such rules will match also on requests without host.

#### Version 1.0.beta8.2 (bugfix)
* fix a bug that caused the subscription `deny_trackers.json` to be
  ignored (#582)
* add some schemes to the temporary whitelist, see #447
  - `gopher`
  - `spotify`
  - `greasemonkey-script`
  - `floatnotes`

#### Version 1.0.beta8.1 (bugfix)
* it was not possible to delete rules (#514)

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
