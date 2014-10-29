# RequestPolicy (continued)

## About RequestPolicy

RequestPolicy is a Firefox extension that gives you control over cross-site
requests. It does this through user-defined whitelists and blacklists. Users
can also subscribe to policies (whitelists and blacklists) maintained by
others.

For more information about RequestPolicy and cross-site requests, have a look at our website:
https://requestpolicycontinued.github.io/requestpolicy/

## Questions? – Feedback, Bugs etc.

If you have any questions or ideas, please post them in our [general discussion](https://github.com/RequestPolicyContinued/requestpolicy/issues/484) or create a new [issue](https://github.com/RequestPolicyContinued/requestpolicy/issues). If you've found a bug, please create directly a new issue.

## This project

The RequestPolicy "Continued" project is a fork of
[RequestPolicy](https://github.com/RequestPolicy/requestpolicy), which had been
developed by [Justin Samuel](https://github.com/jsamuel) until 2012. Currently we aim at releasing our first stable version – 1.0 – but there is still much to do. If you want to be informed about this milestone, you could subscribe to [this issue](https://github.com/RequestPolicyContinued/requestpolicy/issues/446). If you're interested, [here](https://github.com/RequestPolicyContinued/requestpolicy/milestones/1.0)  you can find a list of all open issues for version 1.0.

## License

GPL v3

## Getting the Source Code

If you'd like to download the RequestPolicy source code from our version
control system, you can do so with:

```bash
git clone https://github.com/RequestPolicyContinued/requestpolicy.git
```

Then you can change to the `src/` directory and run

```bash
ant
```

to create a [XPI](https://developer.mozilla.org/en-US/docs/XPI) file. It will be created at `src/dist/requestpolicy.xpi` and can be used for easy installation of RP into your web browser (Firefox).

## Development

You'd like to get more into RequestPolicy? Great! If you simply want to know what's going on in our community, check the [issues list](https://github.com/RequestPolicyContinued/requestpolicy/issues). If you want to get more into the source code, please take a look at our [Development Wiki](https://github.com/RequestPolicyContinued/requestpolicy/wiki). In any case, we would be pleased if you say hello in our [general discussion](https://github.com/RequestPolicyContinued/requestpolicy/issues/484) "issue".

By the way, the wiki can be cloned locally with `git clone https://github.com/RequestPolicyContinued/requestpolicy.wiki.git`. It is included as a git [submodule](http://git-scm.com/book/en/Git-Tools-Submodules) of the main repository, so you can clone both the source and developement wiki in one step with `git clone --recursive https://github.com/RequestPolicyContinued/requestpolicy` or by running `git submodule update --init` inside your copy of the repository.
