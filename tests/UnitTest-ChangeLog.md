### Unit Test ChangeLog of RequestPolicyContinued

Note: The ChangeLog relevant for users you can find in the parent directory.

#### Version 1.0.beta9
* A simple addon has been added to the development environment, called
  "RPC Dev Helper".
* There is now a `.htaccess` file in order to investigate favicon
  requests with redirects, see #573.
* New unit tests are:
```
├── highLevelTests
│   ├── repeatedTests
│   │   ├── detectApplicationRestarts
│   │   │   ├── initDetectingRestarts.js
│   │   │   ├── testAssertNoRestart.js
│   │   │   └── testDetectingRestarts.js
│   │   ├── detectErrors
│   │   │   ├── initDetectingErrors.js
│   │   │   ├── testAssertNoErrors.js
│   │   │   └── testDetectingErrors.js
│   └── restartlessness
│       ├── testDisableExtension.js
│       ├── testEnableExtension.js
│       ├── testInstallExtension.js
│       ├── testUninstallExtension.js
│       └── testUpgradeExtension.js
└── tests
    ├── testPolicy
    │   ├── testRuleWithSchemeOnly.js
    │   └── testSchemeWorkaround
    │       └── testUnknownScheme.js
    ├── testRedirect
    │   ├── testLinkClickRedirectInNewTab.js
    └── testRequestLog
        └── testUriWithoutHost.js
```


#### Version 1.0.beta8
* The base domains `maindomain.test`, `otherdomain.test` and `thirddomain.test`
  have been introduced.
* The test files are now located at `tests/content/`
* The first Mozmill tests have been created. Documentation can be found in the
  RP wiki on github. Currently there are the following tests:
```
├── testLinks
│   ├── testHTMLAnchorElement
│   │   ├── testLinkClick.js
│   │   ├── testOpenInNewTab.js
│   │   └── testOpenInNewWindow.js
│   └── testTextSelection
│       ├── testOpenInCurrentTab.js
│       ├── testOpenInNewTab.js
│       └── testOpenInNewWindow.js
├── testPolicy
│   └── testIframeTree
│       └── testDefaultPolicies.js
└── testRedirect
    ├── testAutoRedirect.js
    └── testLinkClickRedirect.js
```
