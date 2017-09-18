"use strict"; /* jshint node: true */

/* jscs:disable disallowSpacesInsideObjectBrackets */
/* jscs:disable maximumLineLength */

//------------------------------------------------------------------------------
// imports
//------------------------------------------------------------------------------

const exec = require("child_process").exec;
const del = require("del");
const gulp = require("gulp");
const debug = require("gulp-debug"); /* jshint ignore:line */ /* (ignore if unused) */
const gulpif = require("gulp-if");
const gulpIgnore = require("gulp-ignore");
const preprocess = require("gulp-preprocess");
const rename = require("gulp-rename");
const replace = require("gulp-replace");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const zip = require("gulp-zip");
const mergeStream = require("merge-stream");
const nodePath = require("path");

const config = require("./config.json");

//------------------------------------------------------------------------------
// constants, utilities
//------------------------------------------------------------------------------

const srcDirRelative = `src`;
const srcDir = `${__dirname}/${srcDirRelative}`; /* jshint ignore:line */ /* (ignore if unused) */

const EXTENSION_NAME        = "requestpolicy";
const EXTENSION_ID__AMO     = "rpcontinued@amo.requestpolicy.org";
const EXTENSION_ID__OFF_AMO = "rpcontinued@non-amo.requestpolicy.org";

const fileFilter = (function() { /* jshint ignore:line */ /* (ignore if unused) */

  function _array(aAny) {
    return Array.isArray(aAny) ? aAny : [aAny];
  }

  function _set(aAny) {
    return new Set(_array(aAny));
  }

  function pathMatches(aPath, aFilter) {
    /* jshint -W074 */ // This function's cyclomatic complexity is too high.
    if (Array.isArray(aFilter)) {
      return aFilter.some(filter => pathMatches(aPath, filter));
    }
    let {name: stem, ext} = nodePath.parse(aPath);
    if ("pathRegex" in aFilter) {
      if (!_array(aFilter.pathRegex).some(p => aPath.match(p))) { return false; }
    }
    if ("stem" in aFilter) {
      if (!_set(aFilter.stem).has(stem)) { return false; }
    }
    if ("ext" in aFilter) {
      if (!_set(aFilter.ext).has(ext)) { return false; }
    }
    return true;
  }

  const nonModulePaths = [
    "content/bootstrap/data/",
    "content/bootstrap/environments/",
  ];
  const nonModuleStems = [
    "bootstrap",
  ];

  function originalPath(aVinylFile) {
    return aVinylFile.history[0];
  }

  function isModule(aVinylFile) {
    return !pathMatches(originalPath(aVinylFile), [
      {ext: ".jsm"},
      {pathRegex: nonModulePaths},
      {stem: nonModuleStems},
    ]);
  }

  function fileMatches(aFilter, aVinylFile) {
    /* jshint -W074 */ // This function's cyclomatic complexity is too high.
    if (Array.isArray(aFilter)) {
      return aFilter.some(filter => fileMatches(filter, aVinylFile));
    }
    if (!pathMatches(aVinylFile.path, aFilter)) { return false; }
    if ("originalPath" in aFilter) {
      if (!pathMatches(originalPath(aVinylFile), aFilter.originalPath)) { return false; }
    }
    if ("isModule" in aFilter) {
      if (isModule(aVinylFile) !== aFilter.isModule) { return false; }
    }
    if ("not" in aFilter) {
      if (fileMatches(aFilter.not, aVinylFile)) { return false; }
    }
    return true;
  }

  function conditionFactory(aFilter) {
    return aVinylFile => fileMatches(aFilter, aVinylFile);
  }

  return {
    include(aFilter) {
      return gulpIgnore.include(conditionFactory(aFilter));
    },

    if(aFilter, aThen, aElse) {
      return gulpif(conditionFactory(aFilter), aThen, aElse);
    },
  };
}());

function _sanitizeArgsForAddTask(aFn) {
  return function(name, deps, fn) {
    if (fn === undefined && typeof deps === "function") {
      fn = deps;
      deps = [];
    }
    aFn.call(this, name, deps, fn);
  };
}

// ensure that the function passed to "gulp.task" always returns something
// (e.g. a promise, a stream)
gulp.task = (function() {
  const origGulpTask = gulp.task;
  return _sanitizeArgsForAddTask(function(name, deps, fn) {
    if (fn !== undefined) {
      const origFn = fn;
      fn = (...args) => {
        let rv = origFn(...args);
        if (rv === undefined) {
          throw new Error("Function returns undefined");
        }
        return rv;
      };
    }
    origGulpTask.call(this, name, deps, fn);
  });
}());

const addGulpTasks = _sanitizeArgsForAddTask((namePrefix, forcedDeps, taskAdder) => {
  const tasks = [];
  const addTaskFn = _sanitizeArgsForAddTask((name, deps, taskFn) => {
    name = namePrefix + ":" + name;
    deps = forcedDeps.concat(deps);
    tasks.push(name);
    taskFn = taskFn.bind(null, namePrefix);
    gulp.task(name, deps, taskFn);
  });
  taskAdder(addTaskFn, namePrefix);
  // finally, when all tasks are added, add the meta-task
  gulp.task(namePrefix, tasks);
});

//------------------------------------------------------------------------------
// version strings
//------------------------------------------------------------------------------

const versionData = {};

gulp.task("versionData:uniqueVersionSuffix", () => {
  return new Promise((resolve, reject) => {
    exec(`
      rev_count=$(git rev-list HEAD | wc --lines);
      commit_sha=$(git rev-parse --short HEAD);
      echo ".\${rev_count}.r\${commit_sha}.pre";
    `, (err, out) => {
      if (err) {
        reject(err);
        return;
      }
      versionData.uniqueVersionSuffix = out.trim();
      resolve();
    });
  });
});

gulp.task("versionData:nonUniqueVersion", () => {
  versionData.nonUniqueVersion = config.version;
  return Promise.resolve();
});

gulp.task("versionData:uniqueVersion", ["versionData:uniqueVersionSuffix"], () => {
  versionData.uniqueVersion = `${config.version}${versionData.uniqueVersionSuffix}`;
  return Promise.resolve();
});

//==============================================================================
// builds
//==============================================================================

const BUILDS = [
  { alias: "ui-testing",  isDev: true,  isAMO: false, version: "uniqueVersion" },
  { alias: "dev",         isDev: true,  isAMO: false, version: "uniqueVersion" },
  { alias: "nightly",     isDev: false, isAMO: false, version: "uniqueVersion" },
  { alias: "beta",        isDev: false, isAMO: false, version: "nonUniqueVersion" },
  { alias: "amo-nightly", isDev: false, isAMO: true,  version: "uniqueVersion" },
  { alias: "amo-beta",    isDev: false, isAMO: true,  version: "nonUniqueVersion" },
];

const EXTENSION_TYPES = [
  "legacy",
];
const DEFAULT_EXTENSION_TYPE = "legacy";

BUILDS.forEach(build => {
  gulp.task(`build:${build.alias}`, [`build:${DEFAULT_EXTENSION_TYPE}:${build.alias}`]);
  gulp.task(`xpi:${build.alias}`, [`xpi:${DEFAULT_EXTENSION_TYPE}:${build.alias}`]);

  EXTENSION_TYPES.forEach(extensionType => {
    const buildDirRelative = `build/${extensionType}/${build.alias}`;
    const buildDir = `${__dirname}/${buildDirRelative}`;

    const TASK_NAMES = {
      ppContext: `buildData:${extensionType}:${build.alias}:preprocessContext`,
      version: `versionData:${build.version}`,
    };

    //--------------------------------------------------------------------------
    // clean, XPI
    //--------------------------------------------------------------------------

    gulp.task(`clean:${extensionType}:${build.alias}`, () => {
      return del([buildDir]);
    });

    gulp.task(`xpi:${extensionType}:${build.alias}`,
              [`build:${extensionType}:${build.alias}`],
              () => {
      const xpiSuffix = "xpiSuffix" in build ? build.xpiSuffix :
                        `-${extensionType}-${build.alias}`;
      let stream = gulp.src(`${buildDir}/**/*`, { base: buildDir }).
          pipe(zip(`${EXTENSION_NAME}${xpiSuffix}.xpi`)).
          pipe(gulp.dest("dist"));
      return stream;
    });

    //--------------------------------------------------------------------------
    // build data
    //--------------------------------------------------------------------------

    const buildData = {};

    addGulpTasks(`buildData:${extensionType}:${build.alias}`, addTask => {
      addTask("preprocessContext", [TASK_NAMES.version], () => {
        const context = buildData.ppContext = {
          "EXTENSION_ID": build.isAMO ? EXTENSION_ID__AMO : EXTENSION_ID__OFF_AMO,
          "EXTENSION_TYPE": extensionType,
          "RP_HOMEPAGE_URL": config.homepage,
          "RP_VERSION": versionData[build.version],
        };

        if (build.isAMO) { context.AMO = "TRUE"; }
        if (build.alias === "ui-testing") { context.UI_TESTING = "TRUE"; }

        return Promise.resolve();
      });
    });

    //--------------------------------------------------------------------------
    // build utilities
    //--------------------------------------------------------------------------

    const conditionalDirsRelative = [extensionType].
        concat(build.alias === "ui-testing" ? ["ui-testing"] : []).
        map(name => `conditional/${name}`);
    const conditionalDirsWithSrc = conditionalDirsRelative.
        map(dir => `${srcDir}/${dir}`);

    function mergeInConditional(path) {
      conditionalDirsRelative.forEach(dir => {
        // non-root files
        path.dirname = path.dirname.replace(dir + "/", "");
        // root files, e.g. conditional/legacy/bootstrap.js
        path.dirname = path.dirname.replace(dir, "");
      });
    }

    function inAnyRoot(aFilenames) {
      const roots = [srcDir].concat(conditionalDirsWithSrc);
      return aFilenames.reduce((accumulator, curFilename) => {
        if (curFilename.startsWith("**")) {
          throw new Error("paths passed must not start with '**'");
        }
        return accumulator.concat(roots.map(root => `${root}/${curFilename}`));
      }, []);
    }

    //----------------------------------------------------------------------------
    // main build tasks
    //----------------------------------------------------------------------------

    addGulpTasks(`build:${extensionType}:${build.alias}`,
                 [`clean:${extensionType}:${build.alias}`],
                 (addBuildTask, buildTaskPrefix) => {
      addBuildTask("copiedFiles", () => {
        let files = [
          "README",
          "LICENSE",
          "content/**/*.css",
          "content/lib/third-party/**/*.js",
          "skin/*.css",
          "skin/*.png",
          "skin/*.svg",
        ];
        switch (extensionType) {
          case "legacy":
            files = files.concat([
              "chrome.manifest",
              "content/**/*.xul",
              "locale/*/*.dtd",
              "locale/*/*.properties",
            ]);
            break;
        }
        files = inAnyRoot(files);
        let stream = gulp.src(files, { base: srcDir }).
            pipe(rename(mergeInConditional)).
            pipe(gulp.dest(buildDir));
        return stream;
      });

      // ---

      function addPreprocessedFilesBuildTask(aFileType, aFiles) {
        return addBuildTask(`${aFileType}TypePreprocessedFiles`, [TASK_NAMES.ppContext], () => {
          let files = inAnyRoot(aFiles);
          let stream = gulp.src(files, { base: srcDir }).
              pipe(rename(mergeInConditional)).
              pipe(preprocess({ context: buildData.ppContext, extension: aFileType })).
              pipe(gulp.dest(buildDir));
          return stream;
        });
      }

      addPreprocessedFilesBuildTask("xml", [
        "content/**/*.html",
      ].concat(
        extensionType === "webextension" ? [
        ] : extensionType === "legacy" ? [
          "install.rdf",
        ] : []
      ));

      addPreprocessedFilesBuildTask("js", [
      ].concat(
        extensionType === "webextension" ? [
          "manifest.json",
        ] : extensionType === "legacy" ? [
          "content/bootstrap/data/manifest.json",
        ] : []
      ));

      // ---

      const tsProject = ts.createProject("tsconfig.json", {
        rootDir: srcDir,
        outDir: srcDir, // virtual (!) output directory
        // <hack>
        // For whatever inexplicable reason, "content/settings/common.js" and
        // "content/ui/request-log/tree-view.js" are removed by tsProject() if
        // `isolatedModules` is false. However, when the two files are renamed
        // to "common_.js" and "tree-view_.js", respectively, the files are created
        // correctly in the build directory. This is very likely a bug in the
        // "gulp-typescript" module.
        isolatedModules: true,
        // </hack>
      });

      addBuildTask("js", [TASK_NAMES.ppContext], () => {
        let files = [`content/**/*.*(js|jsm|ts)`];
        switch (extensionType) {
          case "legacy":
            files.push(`bootstrap.js`);
            break;
        }
        files = inAnyRoot(files);
        files.push("!**/third-party/**/*");

        let stream = gulp.src(files, { base: srcDir }).
            pipe(replace(
                /console\.(error|warn|info|log|debug)\(\s*(["'`]?)/g,
                (match, fn, stringDelim) => {
                  let argsPrefix = stringDelim === "" ?
                      `"[RequestPolicy] " + ` :
                      `${stringDelim}[RequestPolicy] `;
                  return `console.${fn}(${argsPrefix}`;
                }
            )).
            pipe(preprocess({ context: buildData.ppContext, extension: "js" })).
            pipe(gulpif(build.isDev, sourcemaps.init()));

        stream = mergeStream(
            // non-jsm files
            stream.
                pipe(fileFilter.include({isModule: true})).
                pipe(tsProject()).js,

            // jsm files
            stream.
                pipe(fileFilter.include({isModule: false})));

        stream = stream.
            // WORKAROUND NOTICE:
            // `mergeInConditional` is applied _after_ typescript because I had
            // sourcemapping issues when it was the other way around.
            // (gulp-typescript did not correctly respect the previously created
            // sourcemap.)
            pipe(rename(mergeInConditional)).

            pipe(gulpif(build.isDev, sourcemaps.write({
              destPath: buildDir,
              sourceRoot: `file://${srcDir}`,
            }))).
            pipe(gulp.dest(buildDir));
        return stream;
      });
    });
  });
});

//==============================================================================
// default task
//==============================================================================

gulp.task("default", ["xpi:nightly"]);
