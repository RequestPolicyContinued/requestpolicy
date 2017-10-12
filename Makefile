# NOTE: in this file tab indentation is used.
# Otherwise .RECIPEPREFIX would have to be set.

# http://clarkgrubb.com/makefile-style-guide
MAKEFLAGS += --warn-undefined-variables
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := all
.DELETE_ON_ERROR:
.SUFFIXES:

#===============================================================================
# GNU make HACKS
#===============================================================================

_SPACE :=
_SPACE +=

ifndef MAKECMDGOALS
MAKECMDGOALS :=
endif

_make_invocation_cmd := $(wordlist 2,100000,$(shell ps -o cmd fp $$PPID))
_make_invocation_program := $(firstword $(_make_invocation_cmd))

#===============================================================================
# general variables and targets
#===============================================================================

#-------------------------------------------------------------------------------
# extension metadata
#-------------------------------------------------------------------------------

extension_name        := requestpolicy

#-------------------------------------------------------------------------------
# running, UI testing
#-------------------------------------------------------------------------------

# select the default app. Can be overridden e.g. via `make run app='seamonkey'`
app := firefox
app_branch := default-rp-dev
binary_filename := $(app)
app_binary = dev_env/browsers/$(app)/$(app_branch)/$(binary_filename)

mozrunner_prefs_ini := tests/mozrunner-prefs.ini

#-------------------------------------------------------------------------------
# directories
#-------------------------------------------------------------------------------

source_dir     := src
build_dir_root := build
dist_dir       := dist
logs_dir       := logs

dev_env_dir      := dev_env
python_env_dir   := $(dev_env_dir)/python
browsers_dir     := $(dev_env_dir)/browsers
stamps_dir       := $(dev_env_dir)/.stamps
varstamps_dir    := $(stamps_dir)/vars

node_modules_dir := ./node_modules

# create the dist directory
$(dist_dir) $(logs_dir):
	@mkdir -p $@

#-------------------------------------------------------------------------------
# programs and scripts
#-------------------------------------------------------------------------------

# system
GIT            := /usr/bin/git
NPM            := npm
ZIP            := zip
PYTHON         := $(python_env_dir)/bin/python

# nodejs
ADDONS_LINTER  := $(abspath $(node_modules_dir))/.bin/addons-linter
COFFEELINT     := $(abspath $(node_modules_dir))/.bin/coffeelint
ESLINT         := $(abspath $(node_modules_dir))/.bin/eslint --ext .js,.jsm
GULP           := $(abspath $(node_modules_dir))/.bin/gulp
MOCHA          := $(abspath $(node_modules_dir))/.bin/mocha
TSC            := $(abspath $(node_modules_dir))/.bin/tsc
TSLINT         := $(abspath $(node_modules_dir))/.bin/tslint

# python
PY_PYCODESTYLE := $(abspath $(python_env_dir))/bin/pycodestyle
PY_MOZPROFILE  := $(abspath $(python_env_dir))/bin/mozprofile
PY_MOZRUNNER   := $(abspath $(python_env_dir))/bin/mozrunner


#-------------------------------------------------------------------------------
# helper targets
#-------------------------------------------------------------------------------

# Can force a target to be executed every time.
.PHONY: FORCE
FORCE:

# $1: variable name
_VAR_STAMP_ = $(shell \
  mkdir -p $(varstamps_dir); \
  ./scripts/update_stamp.sh "$(varstamps_dir)/$1" "$($1)"; \
  echo "$(varstamps_dir)/$1" \
)

#-------------------------------------------------------------------------------
# helpers
#-------------------------------------------------------------------------------

# in a pipe
_remove_leading_empty_lines := sed '/./,$$!d'

# $1: command(s) to be wrapped
_remove_all_files_and_dirs_in = find '$1/' '!' -path '$1/' -delete


#===============================================================================
# Building RequestPolicy
#===============================================================================

#-------------------------------------------------------------------------------
# Meta-Targets
#-------------------------------------------------------------------------------

define make_xpi
	$(GULP) xpi:$(1)
endef

define make_files
	$(GULP) build:$(1)
endef

.PHONY: all \
	xpi nightly-xpi beta-xpi ui-testing-xpi amo-beta-xpi amo-nightly-xpi \
	unit-testing-files

all: xpi
xpi: nightly-xpi
nightly-xpi: node-packages
	$(call make_xpi,nightly)
dev-xpi: node-packages
	$(call make_xpi,dev)
beta-xpi: node-packages
	$(call make_xpi,beta)
ui-testing-xpi: node-packages
	$(call make_xpi,ui-testing)
amo-beta-xpi: node-packages
	$(call make_xpi,amo-beta)
amo-nightly-xpi: node-packages
	$(call make_xpi,amo-nightly)

unit-testing-files: node-packages
	$(call make_files,unit-testing)

xpi_file__nightly      := $(dist_dir)/$(extension_name)-legacy-nightly.xpi
xpi_file__dev          := $(dist_dir)/$(extension_name)-legacy-dev.xpi
xpi_file__beta         := $(dist_dir)/$(extension_name)-legacy-beta.xpi
xpi_file__amo_beta     := $(dist_dir)/$(extension_name)-legacy-amo-beta.xpi
xpi_file__amo_nightly  := $(dist_dir)/$(extension_name)-legacy-amo-nightly.xpi
xpi_file__ui_testing   := $(dist_dir)/$(extension_name)-legacy-ui-testing.xpi


#===============================================================================
# Create a XPI from any git-tag or git-commit
#===============================================================================

# Default tree-ish.
specific_xpi__treeish := v1.0.beta9.3__preprocess.py

specific_xpi__file := $(dist_dir)/$(extension_name)-$(specific_xpi__treeish).xpi
specific_xpi__build_dir := $(build_dir_root)/specific-xpi

# create the XPI only if it doesn't exist yet
.PHONY: specific-xpi
specific-xpi: $(specific_xpi__file)

$(specific_xpi__file):
	@# remove the build directory (if it exists) and recreate it
	rm -rf $(specific_xpi__build_dir)
	mkdir -p $(specific_xpi__build_dir)

	@# copy the content of the tree-ish to the build dir
	@# see https://stackoverflow.com/questions/160608/do-a-git-export-like-svn-export/9416271#9416271
	git archive $(specific_xpi__treeish) | (cd $(specific_xpi__build_dir); tar x)

	@# run `make` in the build directory
	(cd $(specific_xpi__build_dir); make)

	@# move the created XPI from the build directory to the actual
	@# dist directory
	mv $(specific_xpi__build_dir)/dist/*.xpi $(specific_xpi__file)


#===============================================================================
# Other XPIs (simple XPIs)
#===============================================================================

#-------------------------------------------------------------------------------
# Meta-Targets
#-------------------------------------------------------------------------------

define make_other_xpi
	@$(MAKE) --no-print-directory _other_xpi OTHER_BUILD=$(1)
endef

.PHONY: _other_xpi \
	dev-helper-xpi ui-testing-helper-xpi dummy-xpi webext-apply-css-xpi

dev-helper-xpi:
	$(call make_other_xpi,dev_helper)
ui-testing-helper-xpi:
	$(call make_other_xpi,ui_testing_helper)
dummy-xpi:
	$(call make_other_xpi,dummy)
webext-apply-css-xpi:
	$(call make_other_xpi,we_apply_css)

#-------------------------------------------------------------------------------
# [VARIABLES] configuration of different builds
#-------------------------------------------------------------------------------

alias__dev_helper        := RPC Dev Helper
alias__ui_testing_helper := RPC UI Testing Helper
alias__dummy             := Dummy
alias__we_apply_css      := Dummy WebExtension

source_path__dev_helper        := tests/helper-addons/dev-helper/
source_path__ui_testing_helper := tests/helper-addons/ui-testing-helper/
source_path__dummy             := tests/helper-addons/dummy-ext/
source_path__we_apply_css      := tests/helper-addons/external/webext-apply-css/

xpi_file__dev_helper         := $(dist_dir)/rpc-dev-helper.xpi
xpi_file__ui_testing_helper  := $(dist_dir)/rpc-ui-testing-helper.xpi
xpi_file__dummy              := $(dist_dir)/dummy-ext.xpi
xpi_file__we_apply_css       := $(dist_dir)/webext-apply-css.xpi

#-------------------------------------------------------------------------------
# intermediate targets
#-------------------------------------------------------------------------------

ifdef OTHER_BUILD
other_build__alias       := $(alias__$(OTHER_BUILD))
other_build__source_path := $(source_path__$(OTHER_BUILD))
other_build__xpi_file    := $(xpi_file__$(OTHER_BUILD))
endif

#-------------------------------------------------------------------------------
# [VARIABLES] collect source files
#-------------------------------------------------------------------------------

ifdef OTHER_BUILD
other_build__src__all_files := $(shell find $(other_build__source_path) -type f)
endif

#-------------------------------------------------------------------------------
# TARGETS
#-------------------------------------------------------------------------------

ifdef OTHER_BUILD
_other_xpi: $(other_build__xpi_file)

# For now use FORCE, i.e. create the XPI every time. If the
# 'FORCE' should be removed, deleted files have to be detected,
# just like for the RequestPolicy XPIs.
$(other_build__xpi_file): $(other_build__src__all_files) FORCE | $(dist_dir)
	@rm -f $(other_build__xpi_file)
	@echo "Creating \"$(other_build__alias)\" XPI."
	@cd $(other_build__source_path) && \
	$(ZIP) $(abspath $(other_build__xpi_file)) $(patsubst $(other_build__source_path)%,%,$(other_build__src__all_files))
	@echo "Creating \"$(other_build__alias)\" XPI: Done!"
endif


#===============================================================================
# Development environment
#===============================================================================

.PHONY: development-environment
development-environment: python-venv node-packages firefox-all

#-------------------------------------------------------------------------------
# timestamps for remakes every x hours/days
#-------------------------------------------------------------------------------

fn_timestamp_file = $(stamps_dir)/.timestamp_$(subst $(_SPACE),_,$1)_ago
force_every = $(shell \
  mkdir -p $(dir $(call fn_timestamp_file,$1)); \
  touch -d '$1 ago' $(call fn_timestamp_file,$1); \
  echo $(call fn_timestamp_file,$1) \
)

#-------------------------------------------------------------------------------
# python
#-------------------------------------------------------------------------------

# timestamp/target files
# NOTE: The timestamp files must reside inside the venv dir,
#   so that when the venv dir is removed, the timestamp files
#   will be removed as well.
T_PYTHON_PACKAGES := $(python_env_dir)/.timestamp_requirements
T_PYTHON_VIRTUALENV := $(python_env_dir)/.timestamp_virtualenv

# increment the value when changing the target
__python_venv__ := v1

.PHONY: python-venv python-packages
python-venv python-packages: $(T_PYTHON_PACKAGES)
$(T_PYTHON_PACKAGES): $(dev_env_dir)/python-requirements.txt \
		$(call force_every,7 days) \
		$(T_PYTHON_VIRTUALENV)
	$(PYTHON) -m pip install --upgrade -r $<
	touch $@
$(T_PYTHON_VIRTUALENV): \
		$(call _VAR_STAMP_,__python_venv__) \
		$(call _VAR_STAMP_,CURDIR) \
		$(call _VAR_STAMP_,python_env_dir)
	rm -rf $(python_env_dir)
	mkdir -p $(python_env_dir)
	virtualenv --no-site-packages --prompt='(RP)' $(python_env_dir)
	@echo $(CURDIR)/tests/python \
	  > $(python_env_dir)/lib/python2.7/site-packages/requestpolicy.pth
	touch $@

#-------------------------------------------------------------------------------
# node.js
#-------------------------------------------------------------------------------

# timestamp/target files
T_NODE_PACKAGES := $(node_modules_dir)/.timestamp_packages

.PHONY: node-packages
node-packages: $(T_NODE_PACKAGES)
$(T_NODE_PACKAGES): package.json \
		$(call force_every,7 days)
	$(NPM) install
	touch $@

#===============================================================================
# Running a Browser + RequestPolicy
#===============================================================================

# arguments for mozrunner
run_additional_xpis :=
_run_xpis := $(xpi_file__dev) $(xpi_file__dev_helper) $(run_additional_xpis)
run_additional_prefs := default
_run_prefs  := common run $(run_additional_prefs)
run_additional_args :=
_run_mozrunner_args := \
	$(addprefix --addon=,$(_run_xpis)) \
	--binary=$(app_binary) \
	$(addprefix  --preferences=$(mozrunner_prefs_ini):,$(_run_prefs)) \
	$(run_additional_args)

.PHONY: run
run: python-venv dev-xpi dev-helper-xpi
	$(PY_MOZRUNNER) $(_run_mozrunner_args)

_dev_profile_dir := .temp/dev_profile
dev_profile_additional_args :=
_dev_profile_mozprofile_args := \
	--profile=$(_dev_profile_dir) \
	$(addprefix --addon=,$(_run_xpis)) \
	$(addprefix  --preferences=$(mozrunner_prefs_ini):,$(_run_prefs)) \
	$(dev_profile_additional_args)

.PHONY: temp-dev-profile
temp-dev-profile: python-venv dev-xpi dev-helper-xpi
	@rm -rf $(_dev_profile_dir)
	@mkdir -p $(_dev_profile_dir)
	$(PY_MOZPROFILE) $(_dev_profile_mozprofile_args)


#===============================================================================
# Testing
#===============================================================================

_ui_subtests := ui-tests-quick ui-tests-non-quick
_quick_tests := static-analysis unit-tests ui-tests-quick
_non_quick_tests := test-makefile ui-tests-non-quick

.PHONY: test-quick test
test-quick: $(_quick_tests)
test-non-quick: $(_non_quick_tests)
test: $(filter-out $(_ui_subtests),$(_quick_tests) $(_non_quick_tests)) ui-tests

#-------------------------------------------------------------------------------
# Testing: unit tests
#-------------------------------------------------------------------------------

.PHONY: unit-tests
unit-tests: mocha

.PHONY: mocha
mocha: node-packages unit-testing-files
	NODE_PATH=$${NODE_PATH+$$NODE_PATH:}$(build_dir_root)/legacy/unit-testing/ \
	$(MOCHA) \
		--compilers coffee:coffeescript/register \
		--require source-map-support/register \
		tests/unit/

#-------------------------------------------------------------------------------
# UI tests
#-------------------------------------------------------------------------------

# Note: currently you have to do some setup before this will work.
# see https://github.com/RequestPolicyContinued/requestpolicy/wiki/Setting-up-a-development-environment#marionette-ui-tests

.PHONY: ui-tests ui-tests-quick ui-tests-non-quick
ui-tests: marionette
ui-tests-quick: marionette-quick
ui-tests-non-quick: marionette-non-quick

_marionette_targets := marionette marionette-quick marionette-non-quick
.PHONY: $(_marionette_targets)
marionette: _args :=
marionette-quick: _args := --quick
marionette-non-quick: _args := --non-quick

$(_marionette_targets): _marionette_dependencies
	./scripts/run_marionette_tests.py --no-make-dependencies $(_args)

.PHONY: _marionette_dependencies
_marionette_dependencies: \
	python-venv $(logs_dir) \
	ui-testing-xpi \
	amo-nightly-xpi specific-xpi \
	dev-helper-xpi ui-testing-helper-xpi \
	dummy-xpi webext-apply-css-xpi

#===============================================================================
# static analysis
#===============================================================================

.PHONY: static-analysis
static-analysis: lint check-locales

#-------------------------------------------------------------------------------
# linting
#-------------------------------------------------------------------------------

.PHONY: lint
lint: lint-coffee lint-js lint-python lint-ts lint-xpi

.PHONY: lint-coffee lint-js lint-python lint-ts lint-xpi
lint-coffee: coffeelint
lint-js: eslint
lint-python: pycodestyle
lint-ts: ts tslint
lint-xpi: addons-linter

.PHONY: addons-linter coffeelint eslint pycodestyle ts tslint
addons-linter: nightly-xpi node-packages
	@echo $@
	@$(ADDONS_LINTER) $(xpi_file__nightly)
coffeelint: node-packages
	@echo $@
	@$(COFFEELINT) $(wildcard tests/unit/*.coffee)
eslint: node-packages
	@echo $@
	@$(ESLINT) src/
	@$(ESLINT) tests/unit/
	@$(ESLINT) tests/xpcshell/
	@$(ESLINT) tests/helper-addons/
	@$(ESLINT) gulpfile.js
pycodestyle: python-packages
	@echo $@
	@$(PY_PYCODESTYLE) scripts/
	@$(PY_PYCODESTYLE) tests/marionette/
ts: node-packages
	@echo $@
	@$(TSC)
tslint: node-packages
	@echo $@
	@$(TSLINT) --exclude '**/third-party/**/*' 'src/**/*.ts' \
		| $(_remove_leading_empty_lines)

#-------------------------------------------------------------------------------
# localization checks
#-------------------------------------------------------------------------------

.PHONY: check-locales
include tests/l10n/Makefile

#-------------------------------------------------------------------------------
# Makefile tests
#-------------------------------------------------------------------------------

.PHONY: test-makefile
test-makefile:
	./scripts/run_makefile_tests


#===============================================================================
# clean targets
#===============================================================================

_clean_targets := clean mostlyclean distclean clean-dev-environment

# ---
# check if ".NOTPARALLEL" is necessary (in case a clean target is part of the goals),
# and perhaps warn the user (in case other, non-clean targets are part of the goals).
# ---

_clean_makecmdgoals := $(filter $(_clean_targets),$(MAKECMDGOALS))
_nonclean_makecmdgoals = $(filter-out $(_clean_targets),$(MAKECMDGOALS))

# NOTE: do not put spaces in the following variable:
_jobs_in_cmdline = \
$(findstring $(space)-j,$(_make_invocation_cmd))\
$(findstring $(space)--jobs,$(_make_invocation_cmd))

define _jobs_warning
WARNING:
    executing NON-parallel! To execute in parallel AND execute clean targets, run
    "$(_make_invocation_program) $(_clean_makecmdgoals) && $(filter-out $(_clean_targets),$(_make_invocation_cmd))"
endef

ifneq '' '$(_clean_makecmdgoals)'
.NOTPARALLEL:
ifneq '' '$(_nonclean_makecmdgoals)'
ifneq '' '$(_jobs_in_cmdline)'
$(info $(_jobs_warning))
endif
endif
endif

# ---
# actual targets
# ---

.PHONY: $(_clean_targets)
clean:
	@rm -rf $(dist_dir)/*.xpi
	@-$(call _remove_all_files_and_dirs_in,$(build_dir_root))
mostlyclean: clean
	@-$(call _remove_all_files_and_dirs_in,$(logs_dir))
clean-dev-environment:
	@-$(call _remove_all_files_and_dirs_in,$(python_env_dir))
	@-$(call _remove_all_files_and_dirs_in,$(node_modules_dir))
	@-$(call _remove_all_files_and_dirs_in,$(stamps_dir))
	@rm -rf $(browsers_dir)/firefox
	@# Do not remove the seamonkey "downloads" dir. Seamonkey tarballs
	@# are put there manually.
	@rm -rf $(browsers_dir)/seamonkey/extracted
distclean: mostlyclean clean-dev-environment
