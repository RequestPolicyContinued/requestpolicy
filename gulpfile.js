/* eslint-env node */
"use strict";

/* eslint max-len: [error, 100], no-multi-spaces: off, object-curly-spacing: off */

// -----------------------------------------------------------------------------
// imports
// -----------------------------------------------------------------------------

const exec = require("child_process").exec;
const del = require("del");
const fs = require("fs");
const gulp = require("gulp");
const changed = require("gulp-changed");
const debug = require("gulp-debug"); // eslint-disable-line no-unused-vars
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
const pify = require("pify");

const config = require("./config.json");

const promiseStat = pify(fs.stat);

// -----------------------------------------------------------------------------
// constants, utilities
// -----------------------------------------------------------------------------

const rootDir = `${__dirname}`;
const srcDirRelative = `src`;
const srcDir = `${rootDir}/${srcDirRelative}`; // eslint-disable-line no-unused-vars

const EXTENSION_NAME        = "requestpolicy";
const EXTENSION_ID__AMO     = "rpcontinued@amo.requestpolicy.org";
const EXTENSION_ID__OFF_AMO = "rpcontinued@non-amo.requestpolicy.org";

const fileFilter = (function() {
  function _array(aAny) {
    return Array.isArray(aAny) ? aAny : [aAny];
  }

  function _set(aAny) {
    return new Set(_array(aAny));
  }

  // eslint-disable-next-line complexity
  function pathMatches(aPath, aFilter) {
    if (Array.isArray(aFilter)) {
      return aFilter.some(filter => pathMatches(aPath, filter));
    }
    let {name: stem, ext} = nodePath.parse(aPath);
    if ("pathRegex" in aFilter) {
      if (!_array(aFilter.pathRegex).some(p => aPath.match(p))) return false;
    }
    if ("stem" in aFilter) {
      if (!_set(aFilter.stem).has(stem)) return false;
    }
    if ("ext" in aFilter) {
      if (!_set(aFilter.ext).has(ext)) return false;
    }
    return true;
  }

  const nonModulePaths = [
    "conditional/legacy/bootstrap",
    "content/bootstrap/data/",
    "content/bootstrap/environments/",
  ];
  const nonModuleStems = [
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

  // eslint-disable-next-line complexity
  function fileMatches(aFilter, aVinylFile) {
    if (Array.isArray(aFilter)) {
      return aFilter.some(filter => fileMatches(filter, aVinylFile));
    }
    if (!pathMatches(aVinylFile.path, aFilter)) return false;
    if ("originalPath" in aFilter) {
      if (!pathMatches(originalPath(aVinylFile), aFilter.originalPath)) return false;
    }
    if ("isModule" in aFilter) {
      if (isModule(aVinylFile) !== aFilter.isModule) return false;
    }
    if ("not" in aFilter) {
      if (fileMatches(aFilter.not, aVinylFile)) return false;
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
})();

function maxDate(dates) {
  return dates.reduce(
      (max, current) => current > max ? current : max,
      new Date(0));
}

function promiseMaxDate(datePromises) {
  const pMaxDate = Promise.
      all(datePromises).
      then(dates => maxDate(dates));
  pMaxDate.catch(e => {
    console.error(e);
  });
  return pMaxDate;
}

function promiseMtime(path) {
  return promiseStat(path).then(({mtime}) => mtime);
}

const getDependenciesMaxMtime = (function() {
  let pMaxMtime;

  let dependencies = [
    "config.json",
    "gulpfile.js",
    "package.json",
    "tsconfig.json",
  ].map(filename => rootDir + "/" + filename);

  return function getDependenciesMtime() {
    if (!pMaxMtime) {
      let pMtimes = dependencies.map(promiseMtime);
      pMaxMtime = Promise.all(pMtimes).then(promiseMaxDate);
    }
    return pMaxMtime;
  };
})();

function compareLastModifiedTime(stream, sourceFile, targetPath) {
  return Promise.all([
    getDependenciesMaxMtime().
        then(maxMtime => maxDate([maxMtime, sourceFile.stat.mtime])),
    promiseMtime(targetPath),
  ]).then(([depsMaxMtime, targetMtime]) => {
    if (depsMaxMtime > targetMtime) {
      stream.push(sourceFile);
    }
    return;
  });
}

function _sanitizeArgsForAddTask(aFn) {
  return function(name, deps, fn) {
    if (fn === undefined && typeof deps === "function") {
      fn = deps;
      deps = [];
    }
    // eslint-disable-next-line no-invalid-this
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
    // eslint-disable-next-line no-invalid-this
    origGulpTask.call(this, name, deps, fn);
  });
})();

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

// -----------------------------------------------------------------------------
// version strings
// -----------------------------------------------------------------------------

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

// =============================================================================
// builds
// =============================================================================

/* eslint-disable max-len */
const BUILDS = [
  { alias: "ui-testing",     isDev: true,  forceCleanBuild: false, isAMO: false, version: "uniqueVersion" },
  { alias: "non-ui-testing", isDev: true,  forceCleanBuild: false, isAMO: false, version: "uniqueVersion" },
  { alias: "dev",            isDev: true,  forceCleanBuild: false, isAMO: false, version: "uniqueVersion" },
  { alias: "nightly",        isDev: false, forceCleanBuild: true,  isAMO: false, version: "uniqueVersion" },
  { alias: "beta",           isDev: false, forceCleanBuild: true,  isAMO: false, version: "nonUniqueVersion" },
  { alias: "amo-nightly",    isDev: false, forceCleanBuild: true,  isAMO: true,  version: "uniqueVersion" },
  { alias: "amo-beta",       isDev: false, forceCleanBuild: true,  isAMO: true,  version: "nonUniqueVersion" },
];
/* eslint-enable max-len */

const EXTENSION_TYPES = [
  "legacy",
];
const DEFAULT_EXTENSION_TYPE = "legacy";

BUILDS.forEach(build => {
  gulp.task(`build:${build.alias}`, [`build:${DEFAULT_EXTENSION_TYPE}:${build.alias}`]);
  gulp.task(`xpi:${build.alias}`, [`xpi:${DEFAULT_EXTENSION_TYPE}:${build.alias}`]);

  EXTENSION_TYPES.forEach(extensionType => {
    const buildDirRelative = `build/${extensionType}/${build.alias}`;
    const buildDir = `${rootDir}/${buildDirRelative}`;

    const TASK_NAMES = {
      ppContext: `buildData:${extensionType}:${build.alias}:preprocessContext`,
      version: `versionData:${build.version}`,
    };

    // -------------------------------------------------------------------------
    // clean, XPI
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // build data
    // -------------------------------------------------------------------------

    const buildData = {};

    addGulpTasks(`buildData:${extensionType}:${build.alias}`, addTask => {
      addTask("preprocessContext", [TASK_NAMES.version], () => {
        const context = buildData.ppContext = {
          "BUILD_ALIAS": build.alias,
          "EXTENSION_ID": build.isAMO ? EXTENSION_ID__AMO : EXTENSION_ID__OFF_AMO,
          "EXTENSION_TYPE": extensionType,
          "RP_HOMEPAGE_URL": config.homepage,
          "RP_VERSION": versionData[build.version],
        };

        if (build.isAMO) context.AMO = "TRUE";

        return Promise.resolve();
      });
    });

    // -------------------------------------------------------------------------
    // build utilities
    // -------------------------------------------------------------------------

    const conditionalDirsRelative = [extensionType].
        concat(build.alias === "ui-testing" ? ["ui-testing"] : []).
        map(name => `conditional/${name}`);
    const conditionalDirsWithSrc = conditionalDirsRelative.
        map(dir => `${srcDir}/${dir}`);

    // eslint-disable-next-line camelcase
    function mergeInConditional_mapDirname(dirname) {
      conditionalDirsRelative.forEach(dir => {
        // non-root files
        dirname = dirname.replace(dir + "/", "");
        // root files, e.g. conditional/legacy/bootstrap.js
        dirname = dirname.replace(dir, "");
      });
      return dirname;
    }

    function mergeInConditional(path) {
      path.dirname = mergeInConditional_mapDirname(path.dirname);
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

    // ---------------------------------------------------------------------------
    // main build tasks
    // ---------------------------------------------------------------------------

    const buildDeps = [];
    if (build.forceCleanBuild) buildDeps.push(`clean:${extensionType}:${build.alias}`);
    addGulpTasks(`build:${extensionType}:${build.alias}`, buildDeps,
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

      const tsConfigOverride = {
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
      };
      if (build.isDev) tsConfigOverride.removeComments = false;
      const tsProject = ts.createProject("tsconfig.json", tsConfigOverride);


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
            pipe(gulpif(!build.forceCleanBuild, changed(buildDir, {
              hasChanged: compareLastModifiedTime,
              transformPath(aPath) {
                let path = mergeInConditional_mapDirname(aPath);
                path = path.replace(/\.(ts)$/, ".js");
                return path;
              },
            }))).
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

            pipe(gulpif(build.isDev,
                gulpif(
                    build.alias === "non-ui-testing",
                    sourcemaps.write({
                      destPath: buildDir,
                      sourceRoot: srcDir,
                    }),
                    sourcemaps.write({
                      destPath: buildDir,
                      sourceRoot: `file://${srcDir}`,
                    })
                )
            )).
            pipe(gulp.dest(buildDir));
        return stream;
      });
    });
  });
});

// =============================================================================
// default task
// =============================================================================

gulp.task("default", ["xpi:nightly"]);
