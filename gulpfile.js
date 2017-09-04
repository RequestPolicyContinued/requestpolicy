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
const preprocess = require("gulp-preprocess");
const zip = require("gulp-zip");

const config = require("./config.json");

//------------------------------------------------------------------------------
// constants, utilities
//------------------------------------------------------------------------------

const EXTENSION_NAME        = "requestpolicy";
const EXTENSION_ID__AMO     = "rpcontinued@amo.requestpolicy.org";
const EXTENSION_ID__OFF_AMO = "rpcontinued@non-amo.requestpolicy.org";

function _sanitizeArgsForAddTask(aFn) {
  return function(name, deps, fn) {
    if (fn === undefined && typeof deps === "function") {
      fn = deps;
      deps = [];
    }
    aFn.call(this, name, deps, fn);
  };
}

// ensure that the function passed to "gulp.task" always returns something (e.g. a promise, a stream)
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
    gulp.task(name, deps, taskFn);
  });
  taskAdder(addTaskFn);
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
  { alias: "ui-testing",   isAMO: false, version: "uniqueVersion" },
  { alias: "nightly",      isAMO: false, version: "uniqueVersion", xpiSuffix: "" },
  { alias: "beta",         isAMO: false, version: "nonUniqueVersion" },
  { alias: "amo-nightly",  isAMO: true,  version: "uniqueVersion" },
  { alias: "amo-beta",     isAMO: true,  version: "nonUniqueVersion" },
];

BUILDS.forEach(build => {
  const buildDir = `build/${build.alias}`;

  const TASK_NAMES = {
    ppContext: `buildData:${build.alias}:preprocessContext`,
    version: `versionData:${build.version}`,
  };

  //----------------------------------------------------------------------------
  // clean, XPI
  //----------------------------------------------------------------------------

  gulp.task(`clean:${build.alias}`, () => {
    return del([buildDir]);
  });

  gulp.task(`xpi:${build.alias}`, [`build:${build.alias}`], () => {
    const xpiSuffix = "xpiSuffix" in build ? build.xpiSuffix : `-${build.alias}`;
    let stream = gulp.src(`${buildDir}/**/*`, { base: buildDir }).
        pipe(zip(`${EXTENSION_NAME}${xpiSuffix}.xpi`)).
        pipe(gulp.dest("dist"));
    return stream;
  });

  //----------------------------------------------------------------------------
  // build data
  //----------------------------------------------------------------------------

  const buildData = {};

  addGulpTasks(`buildData:${build.alias}`, addTask => {
    addTask("preprocessContext", [TASK_NAMES.version], () => {
      const context = buildData.ppContext = {
        "EXTENSION_ID": build.isAMO ? EXTENSION_ID__AMO : EXTENSION_ID__OFF_AMO,
        "RP_HOMEPAGE_URL": config.homepage,
        "RP_VERSION": versionData[build.version],
      };

      if (build.isAMO) { context.AMO = "TRUE"; }
      if (build.alias === "ui-testing") { context.UI_TESTING = "TRUE"; }

      return Promise.resolve();
    });
  });

  //----------------------------------------------------------------------------
  // build
  //----------------------------------------------------------------------------

  addGulpTasks(`build:${build.alias}`, [`clean:${build.alias}`], addBuildTask => {
    addBuildTask("copiedFiles", () => {
      let stream = gulp.src([
        "src/chrome.manifest",
        "src/README",
        "src/LICENSE",
        "src/content/settings/*.css",
        "src/content/settings/*.html",
        "src/content/*.html",
        "src/content/ui/**/*.xul",
        "src/locale/*/*.dtd",
        "src/locale/*/*.properties",
        "src/content/lib/third-party/**/*.js",
        "src/skin/*.css",
        "src/skin/*.png",
        "src/skin/*.svg",
      ], { base: "src" }).
          pipe(gulp.dest(buildDir));
      return stream;
    });

    // ---

    addBuildTask("install-rdf", [TASK_NAMES.ppContext], () => {
      let stream = gulp.src("src/install.rdf", { base: "src" }).
          pipe(preprocess({ context: buildData.ppContext })).
          pipe(gulp.dest(buildDir));
      return stream;
    });

    // ---

    addBuildTask("js", [TASK_NAMES.ppContext], () => {
      let sources = ["src/**/*.js", "src/**/*.jsm", "!**/third-party/**/*"];
      let stream = gulp.src(sources, { base: "src" }).
          pipe(preprocess({ context: buildData.ppContext, extension: "js" })).
          pipe(gulp.dest(buildDir));
      return stream;
    });
  });
});

//==============================================================================
// default task
//==============================================================================

gulp.task("default", ["xpi:nightly"]);
