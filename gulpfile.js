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
const preprocess = require("gulp-preprocess");
const rename = require("gulp-rename");
const replace = require("gulp-replace");
const ts = require("gulp-typescript");
const zip = require("gulp-zip");

const config = require("./config.json");

//------------------------------------------------------------------------------
// constants, utilities
//------------------------------------------------------------------------------

const EXTENSION_NAME        = "requestpolicy";
const EXTENSION_ID__AMO     = "rpcontinued@amo.requestpolicy.org";
const EXTENSION_ID__OFF_AMO = "rpcontinued@non-amo.requestpolicy.org";

function isJsm(aVinylFile) {
  return aVinylFile.path.endsWith(".jsm");
}

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
  // build utilities
  //----------------------------------------------------------------------------

  const extensionType = "legacy";

  const conditionalDirs = [extensionType].
      concat(build.alias === "ui-testing" ? ["ui-testing"] : []).
      map(name => `conditional/${name}`);
  const conditionalDirsWithSrc = conditionalDirs.
      map(dir => `src/${dir}`);

  function mergeInConditional(path) {
    conditionalDirs.forEach(dir => {
      path.dirname = path.dirname.replace(dir + "/", "");  // non-root files
      path.dirname = path.dirname.replace(dir, "");  // root files, e.g. conditional/legacy/bootstrap.js
    });
  }

  function inAnyRoot(aFilenames) {
    const roots = ["src"].concat(conditionalDirsWithSrc);
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

  addGulpTasks(`build:${build.alias}`, [`clean:${build.alias}`], addBuildTask => {
    addBuildTask("copiedFiles", () => {
      let files = [
        "README",
        "LICENSE",
        "content/**/*.css",
        "content/**/*.html",
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
      let stream = gulp.src(files, { base: "src" }).
          pipe(rename(mergeInConditional)).
          pipe(gulp.dest(buildDir));
      return stream;
    });

    addBuildTask("manifest-json", [TASK_NAMES.ppContext], () => {
      let file;
      switch (extensionType) {
        case "webextension":
          file = "manifest.json";
          break;
        case "legacy":
          file = "content/bootstrap/data/manifest.json";
          break;
      }
      file = inAnyRoot([file]);
      let stream = gulp.src(file, { base: "src" }).
          pipe(rename(mergeInConditional)).
          pipe(preprocess({ context: buildData.ppContext })).
          pipe(gulp.dest(buildDir));
      return stream;
    });

    // ---

    if (extensionType === "legacy") {
      addBuildTask("install-rdf", [TASK_NAMES.ppContext], () => {
        let file = inAnyRoot(["install.rdf"]);
        let stream = gulp.src(file, { base: "src" }).
            pipe(rename(mergeInConditional)).
            pipe(preprocess({ context: buildData.ppContext })).
            pipe(gulp.dest(buildDir));
        return stream;
      });
    }

    // ---

    const tsProject = ts.createProject("tsconfig.json", {
      outDir: buildDir,
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

      let stream = gulp.src(files, { base: "src" }).
          pipe(rename(mergeInConditional)).
          pipe(preprocess({ context: buildData.ppContext, extension: "js" })).
          pipe(replace(
              /console\.(error|warn|info|log|debug)\(\s*(["'`]?)/g,
              (match, fn, stringDelim) => {
                let argsPrefix = stringDelim === "" ?
                    `"[RequestPolicy] " + ` :
                    `${stringDelim}[RequestPolicy] `;
                return `console.${fn}(${argsPrefix}`;
              }
          )).
          pipe(gulpif(
              file => !isJsm(file),
              tsProject()
          ));
      stream = stream.js || stream; // gulp-typescript
      stream = stream.
          pipe(gulp.dest(buildDir));
      return stream;
    });
  });
});

//==============================================================================
// default task
//==============================================================================

gulp.task("default", ["xpi:nightly"]);
