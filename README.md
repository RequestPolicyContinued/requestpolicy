# RequestPolicy

RequestPolicy is a Firefox extension that gives you control over cross-site
requests. It does this through user-defined whitelists and blacklists. Users
can also subscribe to policies (whitelists and blacklists) maintained by
others.

For more information about RequestPolicy and cross-site requests, see
https://www.requestpolicy.com

## Author

Justin Samuel (jsamuel) is the author of RequestPolicy.

## License

GPL v3

## Communication

General discussion list:
https://groups.google.com/d/forum/requestpolicy-discuss

If you're hacking on RequestPolicy, you can ask questions here:
https://groups.google.com/d/forum/requestpolicy-dev

## Issue tracker

We track bugs and feature requests on github:
https://github.com/RequestPolicy/requestpolicy/issues

# Development

## Getting the Source Code

If you'd like to download the RequestPolicy source code from our version
control system, you can do so with:

    git clone git@github.com:RequestPolicy/requestpolicy.git

The above command will create a directory called `requestpolicy`. Under that
is a `src` directory where the source code lives.

Note that any RequestPolicy XPI (the extension file you install in your
browser) contains all of the source code, as well. XPI files are just zip
archives which you can extract like any other. However, in version control
there's a `chrome.manifest` file for local development that you'll probably
want to use even if you're working from an extracted XPI. 

## Building the Extension XPI

Currently, ant is used. (Sorry, I had an ant build script for Firefox
extensions handy when I first started on RP, so I used that.)

To build, run the following commands:

    cd src
    ant

After the build completes, the xpi will be located at
`dist/requestpolicy.xpi`.

## Developing Without Rebuilding the XPI

It's annoying to have to rebuild and reinstall the extension constantly during
development. To avoid that, you can create a "proxy" extension by creating a
file in your Firefox profile's extensions directory which tells Firefox that
it should look for the unpackaged extension files in a directory of your
choice.

To install a proxy extension, first create a new Firefox profile through the
Firefox profile manager. To open the profile manager:

    firefox -no-remote -profilemanager

Start Firefox using that profile, either selecting it in the profile manager
or using the command:

    firefox -no-remote -P PROFILENAME

Now close this Firefox instance.

After you've created the new profile, figure out the profile directory. On
linux, it will often be "~/.mozilla/firefox/xxxxxx.the-profile-name". I'll
call this PROFILE_DIRECTORY from here on out.

Next, use the following commands to create the proxy extension file for
RequestPolicy in your new profile.

    # Change directory to your new profile's directory.
    cd PROFILE_DIRECTORY
    
    # Create the 'extensions' directory and change to that directory.
    test -d extensions || mkdir extensions
    cd extensions
    
    # Create a file called 'requestpolicy@requestpolicy.com' with a single
    # line in the file which is the path to the 'src' directory. 
    echo "/path/to/requestpolicy/src" > requestpolicy@requestpolicy.com

Now start Firefox again using that profile. Firefox should now consider the
extension installed. To verify this, go to Tools > Addons > Extensions. You
should see RequestPolicy listed among the extensions.

If RequestPolicy is not installed at this point, you may need to repeat the
above steps to create the proxy extension file before trying again. This is
because if Firefox sees a problem with your proxy extension file (e.g. it's
named incorrectly or the path to the `src` directory in the file is
incorrect), Firefox may delete the file.

Note that you shouldn't try to install the extension xpi in a profile where
you've already created the proxy extension. To use an xpi that you've built,
use a new profile.

## Working with the Code

Now that you have a development environment setup, you can start tinkering
with the code. The first thing to do is to change the RequestPolicy version
number. To do this, edit the file `src/install.rdf` and, for example, change:

    <em:version>0.5.23</em:version>

to:

    <em:version>0.5.23-yourname1</em:version>

Now restart Firefox (the instance running your development profile you setup
in the steps above) and check `about:addons` to verify that the new version
number is shown there. If it is, you're almost ready to start developing.

The most common problem to hit at this point is that your version of Firefox
is not supported by RequestPolicy (or, at least, is not supported by the
particular RequestPolicy code you're starting development with). If
necessary, you can force RequestPolicy to work with your version of Firefox by
editing the file `src/install.rdf` and changing the values of minVersion or
maxVersion.

The next thing to do is to enable RequestPolicy's logging. In Firefox, go to
the URL `about:config`. Search for the keys containing `requestpolicy`. Locate
the one called `extensions.requestpolicy.log`. Double-click this row to change
the value to `true`. Now quit/exit/close Firefox. Note that you need to quit
Firefox using File > Quit or by closing all browser windows. If you kill
Firefox, e.g. with CTRL+c, the setting won't be saved because Firefox is a bit
silly about when it decides to write settings changes to the settings files in
your Firefox profile's directory.

Now, start Firefox again and be sure to start it '''from a command line'''.
The logging will be done to stderr, not to Firefox's error console. So,
if you don't start Firefox in a way that lets you see or capture stderr, you
won't have access to the logged information. Assuming that when you start
Firefox from a command line you see bunches of RequestPolicy log messages in
the terminal you started Firefox from, you're ready to start developing.

If you want to capture the logged information to a file, you can redirect
stderr to a file when you start Firefox. For example, the following command
will start Firefox in the background and will redirect both stdout and stderr
to a file named `rp.log`:

    firefox -no-remote -P PROFILENAME >rp.log 2>&1 &
