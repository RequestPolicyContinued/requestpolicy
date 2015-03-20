### Unit Test ChangeLog of RequestPolicy Continued

Note: The ChangeLog relevant for users you can find in the parent directory.

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
