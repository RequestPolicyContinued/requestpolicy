# RequestPolicy (continued)

## About RequestPolicy

RequestPolicy is a Firefox extension that gives you control over cross-site requests. It does this through user-defined whitelists and blacklists. Users can also subscribe to policies (whitelists and blacklists) maintained by others.

For more information about RequestPolicy and cross-site requests, have a look at [our website](https://requestpolicycontinued.github.io/)

## This project

The RequestPolicy "Continued" project is a fork of [RequestPolicy](https://github.com/RequestPolicy/requestpolicy), which had been developed by [Justin Samuel](https://github.com/jsamuel) until 2012. Currently we aim at releasing our first stable version – 1.0 – but there is still much to do. If you want to be informed about this milestone, you could subscribe to [this issue](https://github.com/RequestPolicyContinued/requestpolicy/issues/446). If you're interested, [here](https://github.com/RequestPolicyContinued/requestpolicy/milestones/1.0)  you can find a list of all open issues for version 1.0.


## Getting the Source Code

If you'd like to download the RequestPolicy source code from our version control system, you can do so with:

```bash
git clone https://github.com/RequestPolicyContinued/requestpolicy.git
```

## Building the XPI Firefox addon

Before building you need to install [GNU Make](https://www.gnu.org/software/make/) as well as [`preprocess.py`](https://code.google.com/p/preprocess/). On a debian-based system you could run:

```bash
sudo apt-get install make preprocess
```

After preparation, run `make` from the repository's root directory.  The [XPI](https://developer.mozilla.org/en-US/docs/XPI) file will be created at `dist/requestpolicy.xpi` and can be used for easy installation of RP into your web browser (e.g. Firefox).


## License

[GPL v3](LICENSE)

----------------------------------------

## Contributing

Here are a few ways you can help make this project better!

### Discussion
If you have any questions or general thoughts about the project, please post them in our [general discussion](https://github.com/RequestPolicyContinued/requestpolicy/issues/484)


### Testing, reporting bugs & requesting new features

Always use the [latest release](https://github.com/RequestPolicyContinued/requestpolicy/releases/), or [build the XPI from the most recent source revision](https://github.com/RequestPolicyContinued/requestpolicy#getting-the-source-code)

If you'd like a bug to be fixed or a feature added, [find if it has already been reported](https://github.com/RequestPolicyContinued/requestpolicy/issues). Open a new issue if needed, and add information about the bug/request such as:

 * Steps to reproduce the bug (user actions)
 * What should happen.
 * What happens instead.

Response time from the maintainers should be around a few days.

**Please bear in mind that each user might have a different browser setup. Sometimes it's necessary to further investigate the problem:**

Some bugs are caused by other Firefox addons interfering with RequestPolicy. To make sure a bug is caused by RequestPolicy itself:

 * Disable all other addons from Firefox's addon manager
 * Try to reproduce the bug

If the bug does _not_ happen with only RPC enabled, the bug is related to another addon:

 * Re-enable one addon, test again.
 * Repeat until the problem occurs again
 * [Report us](https://github.com/RequestPolicyContinued/requestpolicy/issues) the incompatible addon (with a link to the addon download page)

To test if the bug is related to your specific configuration, you can [create a new, blank Firefox profile](https://support.mozilla.org/en-US/kb/profile-manager-create-and-remove-firefox-profiles) and try to reproduce the bug.


### Code contributions

You can look through the existing bugs/requests [here](https://github.com/RequestPolicyContinued/requestpolicy/issues).

You can find bugs that should be easy to fix [here](https://github.com/RequestPolicyContinued/requestpolicy/labels/easy).

More information on RequestPolicy development can be found [here](https://github.com/RequestPolicyContinued/requestpolicy/wiki)


### Translations

You can help us translate our project by [editing the locale files](https://github.com/RequestPolicyContinued/requestpolicy/tree/dev-1.0/src/locale) and sending us a Pull Request. 



### Documentation and website

You can help build and design the website and documentation [here](https://github.com/requestpolicycontinued/requestpolicycontinued.github.io)


### Bug triage

You can help us find more info about [unconfirmed bugs](https://github.com/RequestPolicyContinued/requestpolicy/issues?q=is%3Aopen+is%3Aissue+label%3Aunconfirmed+) by finding if the bug is reproducible. In what environment? What are the steps to reproduce? 
 
You can ask the maintainers to close already fixed bugs by testing old tickets to see if they are happening, or remove duplicate bug reports.

### Donations
You can add [bounties at bountysource](https://www.bountysource.com/teams/requestpolicycontinued/issues) for bugs you would like to be fixed.

### Community  and support

* You can help us answer questions our users have on the issue tracker
* You can write posts about the project, take screenshots and make videos, share RequestPolicy Continued on the Internet, show how it's used in daily life, and talk about it to your friends.
