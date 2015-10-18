# RequestPolicy Continued

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

Before building you need to install [GNU Make](https://www.gnu.org/software/make/) as well as the npm package [`preprocessor`](https://www.npmjs.com/package/preprocessor). On a debian-based system you could run:

```bash
sudo apt-get install make npm
sudo npm install -g preprocessor
```

After preparation, run `make` from the repository's root directory.  The [XPI](https://developer.mozilla.org/en-US/docs/XPI) file will be created at `dist/requestpolicy.xpi` and can be used for easy installation of RP into your web browser (e.g. Firefox).


## License

[GPL v3](LICENSE)


## Contributing

See [here](https://requestpolicycontinued.github.io/Contributing.html).
