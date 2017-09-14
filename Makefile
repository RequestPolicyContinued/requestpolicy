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
# general variables and targets
#===============================================================================

ZIP        := zip
GIT        := /usr/bin/git
PREPROCESS := /usr/bin/preprocess --content-types-path build/preprocess-content-types.txt

#-------------------------------------------------------------------------------
# extension metadata
#-------------------------------------------------------------------------------

extension_name        := requestpolicy
amo__extension_id     := rpcontinued@amo.requestpolicy.org
off_amo__extension_id := rpcontinued@non-amo.requestpolicy.org

#-------------------------------------------------------------------------------
# directories
#-------------------------------------------------------------------------------

source_dir     := src
build_dir_root := build
dist_dir       := dist
logs_dir       := logs

dev_env_dir    := dev_env
python_env_dir := $(dev_env_dir)/python
node_env_dir   := $(dev_env_dir)/node
browsers_dir   := $(dev_env_dir)/browsers

NPM            := npm --prefix=$(node_env_dir)
JSCS           := $(abspath $(node_env_dir))/node_modules/.bin/jscs
JSHINT         := $(abspath $(node_env_dir))/node_modules/.bin/jshint --extra-ext jsm
ADDONS_LINTER  := $(abspath $(node_env_dir))/node_modules/.bin/addons-linter

# create the dist directory
$(dist_dir) $(logs_dir):
	@mkdir -p $@

#-------------------------------------------------------------------------------
# other
#-------------------------------------------------------------------------------

.PHONY: preprocessor
preprocessor: $(build_dir_root)/preprocess-content-types.txt
$(build_dir_root)/preprocess-content-types.txt:
	echo 'JavaScript .jsm' > $@

#-------------------------------------------------------------------------------
# helpers
#-------------------------------------------------------------------------------

# $1: command(s) to be wrapped
_remove_all_files_and_dirs_in = find '$1/' '!' -path '$1/' -delete


#===============================================================================
# Building RequestPolicy
#===============================================================================

#-------------------------------------------------------------------------------
# Meta-Targets
#-------------------------------------------------------------------------------

define make_xpi
	@$(MAKE) --no-print-directory _xpi BUILD=$(1)
endef

define make_files
	@$(MAKE) --no-print-directory _files BUILD=$(1)
endef

.PHONY: all _xpi _files \
	xpi unit-testing-xpi amo-beta-xpi amo-nightly-xpi \
	unit-testing-files

all: xpi
xpi: nightly-xpi
nightly-xpi:
	$(call make_xpi,nightly)
beta-xpi:
	$(call make_xpi,beta)
unit-testing-xpi:
	$(call make_xpi,unit_testing)
amo-beta-xpi:
	$(call make_xpi,amo_beta)
amo-nightly-xpi:
	$(call make_xpi,amo_nightly)

unit-testing-files:
	$(call make_files,unit_testing)

#-------------------------------------------------------------------------------
# [VARIABLES] configuration of different builds
#-------------------------------------------------------------------------------

alias__nightly       := nightly
alias__beta          := beta
alias__amo_beta      := AMO-beta
alias__amo_nightly   := AMO-nightly
alias__unit_testing  := unit-testing

extension_id__nightly      := $(off_amo__extension_id)
extension_id__beta         := $(off_amo__extension_id)
extension_id__amo_beta     := $(amo__extension_id)
extension_id__amo_nightly  := $(amo__extension_id)
extension_id__unit_testing := $(off_amo__extension_id)

xpi_file__nightly      := $(dist_dir)/$(extension_name).xpi
xpi_file__beta         := $(dist_dir)/$(extension_name)-beta.xpi
xpi_file__amo_beta     := $(dist_dir)/$(extension_name)-amo-beta.xpi
xpi_file__amo_nightly  := $(dist_dir)/$(extension_name)-amo-nightly.xpi
xpi_file__unit_testing := $(dist_dir)/$(extension_name)-unit-testing.xpi

preprocess_args__nightly      :=
preprocess_args__beta         :=
preprocess_args__amo_beta     := -D AMO
preprocess_args__amo_nightly  := -D AMO
preprocess_args__unit_testing := --keep-lines -D UNIT_TESTING

unique_version__nightly      := yes
unique_version__beta         := no
unique_version__amo_beta     := no
unique_version__amo_nightly  := yes
unique_version__unit_testing := yes

ifdef BUILD

#-------------------------------------------------------------------------------
# [VARIABLES] this configuration
#-------------------------------------------------------------------------------

current_build__alias           := $(alias__$(BUILD))
current_build__extension_id    := $(extension_id__$(BUILD))
current_build__xpi_file        := $(xpi_file__$(BUILD))
current_build__preprocess_args := $(preprocess_args__$(BUILD))
current_build__unique_version  := $(unique_version__$(BUILD))

#-------------------------------------------------------------------------------
# [VARIABLES] collect source files
#-------------------------------------------------------------------------------

# files which are simply copied
src__copy_files := \
		$(source_dir)/chrome.manifest \
		$(source_dir)/README \
		$(source_dir)/LICENSE \
		$(wildcard $(source_dir)/content/settings/*.css) \
		$(wildcard $(source_dir)/content/settings/*.html) \
		$(wildcard $(source_dir)/content/*.html) \
		$(wildcard $(source_dir)/content/ui/*.xul) \
		$(wildcard $(source_dir)/locale/*/*.dtd) \
		$(wildcard $(source_dir)/locale/*/*.properties) \
		$(wildcard $(source_dir)/skin/*.css) \
		$(wildcard $(source_dir)/skin/*.png) \
		$(wildcard $(source_dir)/skin/*.svg) \
		$(shell find $(source_dir) -type f -iname "jquery*.js")

src__install_rdf := \
	$(source_dir)/install.rdf

# JavaScript files which will be (pre)processed.
# The `copy_files` will be filtered out.
src__jspp_files := \
		$(filter-out $(src__copy_files) $(src__install_rdf), \
				$(shell find $(source_dir) -type f -regex ".*\.jsm?") \
		)

# all source files
src__all_files := $(src__copy_files) $(src__install_rdf) $(src__jspp_files)

#-------------------------------------------------------------------------------
# [VARIABLES] paths in the "build" directory
#-------------------------------------------------------------------------------

current_build_dir := $(build_dir_root)/$(BUILD)

build__all_files  := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__all_files))
build__jspp_files := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__jspp_files))
build__copy_files := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__copy_files))
build__install_rdf := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__install_rdf))

# detect deleted files and empty directories
ifdef BUILD
build__deleted_files :=
build__empty_dirs :=
ifneq "$(wildcard $(current_build_dir))" ""
	# files that have been deleted but still exist in the build directory.
	build__deleted_files := $(shell find $(current_build_dir) -type f | \
		grep -F -v $(addprefix -e ,$(build__all_files)))
	# empty directories. -mindepth 1 to exclude the build directory itself.
	build__empty_dirs := $(shell find $(current_build_dir) -mindepth 1 -type d -empty)
endif
endif

build_files_including_removals := $(build__all_files) $(build__deleted_files) $(build__empty_dirs)

#-------------------------------------------------------------------------------
# [TARGETS] intermediate targets
#-------------------------------------------------------------------------------

_xpi: $(current_build__xpi_file)
_files: $(build_files_including_removals)

#-------------------------------------------------------------------------------
# [TARGETS] preprocess and/or copy files (src/ --> build/)
#-------------------------------------------------------------------------------

$(build__jspp_files) : $(current_build_dir)/% : $(source_dir)/% | preprocessor
	@mkdir -p $(@D)
	$(PREPROCESS) $(current_build__preprocess_args) $< > $@

$(build__copy_files) : $(current_build_dir)/% : $(source_dir)/%
	@mkdir -p $(@D)
	@# Use `--dereference` to copy the files instead of the symlinks.
	cp --dereference $< $@

# force rebuild of install.rdf because the version suffix might change
$(build__install_rdf) : $(current_build_dir)/% : $(source_dir)/% \
		FORCE
	cp --dereference $< $@
	@if [[ "$(current_build__extension_id)" == "$(amo__extension_id)" ]]; then \
		echo 'install.rdf: changing the Extension ID !' ; \
		sed -i s/$(off_amo__extension_id)/$(amo__extension_id)/ $@ ; \
		echo 'install.rdf: removing the updateURL !' ; \
		sed -i '/<em:updateURL>.*<\/em:updateURL>/d' $@ ; \
	fi ; \
	if [[ "$(current_build__unique_version)" == "yes" ]]; then \
		echo 'install.rdf: making the version unique !' ; \
			unique_suffix=`./scripts/get_unique_version_suffix.sh` ; \
		sed -i 's,\(</em:version>\),'$${unique_suffix}'\1,' $@ ; \
	fi

#-------------------------------------------------------------------------------
# [TARGETS] remove files/dirs no longer existant in the source
#-------------------------------------------------------------------------------

$(build__empty_dirs): FORCE
	rmdir $@

$(build__deleted_files): FORCE
	@# delete:
	rm $@
	@# delete parent dirs if empty:
	@rmdir --parents --ignore-fail-on-non-empty $(@D)

#-------------------------------------------------------------------------------
# [TARGETS] package the files to a XPI
#-------------------------------------------------------------------------------

$(current_build__xpi_file): $(build_files_including_removals) | $(dist_dir)
	@rm -f $(current_build__xpi_file)
	@echo "Creating \"$(current_build__alias)\" XPI file."
	@cd $(current_build_dir) && \
	$(ZIP) $(abspath $(current_build__xpi_file)) \
		$(patsubst $(source_dir)/%,%,$(src__all_files))
	@echo "Creating \"$(current_build__alias)\" XPI file: Done!"

endif

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
	dev-helper-xpi dummy-xpi

dev-helper-xpi:
	$(call make_other_xpi,dev_helper)
dummy-xpi:
	$(call make_other_xpi,dummy)
webext-apply-css-xpi:
	$(call make_other_xpi,we_apply_css)

#-------------------------------------------------------------------------------
# [VARIABLES] configuration of different builds
#-------------------------------------------------------------------------------

alias__dev_helper   := RPC Dev Helper
alias__dummy        := Dummy
alias__we_apply_css := Dummy WebExtension

source_path__dev_helper   := tests/helper-addons/dev-helper/
source_path__dummy        := tests/helper-addons/dummy-ext/
source_path__we_apply_css := tests/helper-addons/external/webext-apply-css/

xpi_file__dev_helper   := $(dist_dir)/rpc-dev-helper.xpi
xpi_file__dummy        := $(dist_dir)/dummy-ext.xpi
xpi_file__we_apply_css := $(dist_dir)/webext-apply-css.xpi

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

PHONY: development-environment
development-environment: python-venv node-packages firefox-all

#-------------------------------------------------------------------------------
# timestamps for remakes every x hours/days
#-------------------------------------------------------------------------------

space :=
space +=
fn_timestamp_file = $(build_dir_root)/.timestamp_$(subst $(space),_,$1)_ago
force_every = $(shell \
  mkdir -p $(dir $(call fn_timestamp_file,$1)); \
  touch -d '$1 ago' $(call fn_timestamp_file,$1); \
  test $(call fn_timestamp_file,$1) -nt $2 && \
    echo -n FORCE \
)

#-------------------------------------------------------------------------------
# python
#-------------------------------------------------------------------------------

# $1: command(s) to be wrapped
IN_PYTHON_ENV = set +u && source $(python_env_dir)/bin/activate && ($1)

# $1: variable name which will contain the profile dir
# $2: parameters to mozprofile
# $3: command(s) to be wrapped
WITH_MOZPROFILE = \
	$1=`mozprofile $2` && ( \
		($3); \
		exit_status=$$? ; \
		rm -rf $$$1 ; \
		exit $$exit_status ; \
	) ;

# timestamp/target files
# NOTE: The timestamp files must reside inside the venv dir,
#   so that when the venv dir is removed, the timestamp files
#   will be removed as well.
T_PYTHON_PACKAGES := $(python_env_dir)/.timestamp_requirements
T_PYTHON_VIRTUALENV := $(python_env_dir)/.timestamp_virtualenv

.PHONY: python-venv
python-venv: $(T_PYTHON_PACKAGES)
$(T_PYTHON_PACKAGES): $(dev_env_dir)/python-requirements.txt \
		$(call force_every,7 days,$(T_PYTHON_PACKAGES)) \
		| $(T_PYTHON_VIRTUALENV)
	$(call IN_PYTHON_ENV, \
		pip install --upgrade -r $< \
	)
	touch $@
$(T_PYTHON_VIRTUALENV):
	mkdir -p $(python_env_dir)
	virtualenv --no-site-packages --prompt='(RP)' $(python_env_dir)
	touch $@

#-------------------------------------------------------------------------------
# node.js
#-------------------------------------------------------------------------------

# timestamp/target files
T_NODE_PACKAGES := $(node_env_dir)/.timestamp_packages

.PHONY: node-packages
node-packages: $(T_NODE_PACKAGES)
$(T_NODE_PACKAGES): $(dev_env_dir)/node-packages.txt \
		$(call force_every,7 days,$(T_NODE_PACKAGES))
	grep -Ev '^\#' $< | xargs $(NPM) install
	touch $@

#-------------------------------------------------------------------------------
# browsers
#-------------------------------------------------------------------------------

# TODO: Automatically download seamonkey tarball.
#         https://archive.mozilla.org/pub/seamonkey/
#       However, mozdownload only supports 'b2g', 'firefox', 'fennec' and
#       'thunderbird' as --application. So maybe use wget instead.

# FIXME: Add support for fx-release and fx-beta (unbranded)
#          https://github.com/mozilla/mozdownload/issues/407
#        Maybe use "get-firefox" instead?
#          https://www.npmjs.com/package/get-firefox
#firefox_branches := esr release beta aurora nightly
firefox_branches := esr aurora nightly
seamonkey_branches := release

mozdl_opts_firefox_esr             := --type release --version latest-esr
# There is no option for "add-on-devel" (unbranded releases) yet; see above.
#mozdl_opts_firefox_release         := --type tinderbox --branch mozilla-release --??? add-on-devel
#mozdl_opts_firefox_beta            := --type tinderbox --branch mozilla-beta --??? add-on-devel
mozdl_opts_firefox_aurora          := --type daily --branch mozilla-aurora
mozdl_opts_firefox_nightly         := --type daily --branch mozilla-central

mozdl_supported_browsers := firefox

# timestamp of last mozdownload execution
T_BROWSER = $(browsers_dir)/$1/downloads/$2/.timestamp

define fn_create_browser_target
.PHONY: $1-$2
$1-$2: $(browsers_dir)/$1/extracted/$2/$1
$(browsers_dir)/$1/extracted/$2/$1: \
		$(browsers_dir)/$1/downloads/latest-$2.tar.bz2
	rm -rf $(browsers_dir)/$1/extracted/$2/
	mkdir -p $(browsers_dir)/$1/extracted/$2/
	tar -xjf $$< -C $(browsers_dir)/$1/extracted/$2/ --strip-components=1
	touch $$@
ifneq "$(filter $(mozdl_supported_browsers),$1)" ""
# The T_BROWSER timestamp file is decoupled from the tarball-target.
# Make will check for the newest tarball in fixed intervals (force_every),
# but the tarball will only be extracted iff a new tarball has been
# downloaded (i.e., a new update has been available).
$(browsers_dir)/$1/downloads/latest-$2.tar.bz2: \
		$(call force_every,12 hours,$(call T_BROWSER,$1,$2)) \
		| python-venv
	mkdir -p $(browsers_dir)/$1/downloads/$2/
	$$(call IN_PYTHON_ENV, \
	  mozdownload \
	    --destination $(browsers_dir)/$1/downloads/$2/ \
	    --extension tar.bz2 --application $1 \
	    $$(mozdl_opts_$1_$2) \
	)
	ln -sf $$$$(cd $$(dir $$@); ls -t $2/*.tar.bz2 | head -n 1) $$@
	touch --reference="$$$$(readlink -f $$@)" $$@
	touch $(call T_BROWSER,$1,$2)
else
$(browsers_dir)/$1/downloads/latest-$2.tar.bz2:
	$$(error \
	  $1 cannot be downloaded automatically, yet. \
	  Please put the $1 tarball at "$$@". \
	  The tarball will then be extracted automatically. \
	  Make sure to download the correct file (32 bit or 64 bit) \
	  as the 32-bit version won't work on 64-bit systems. \
	)
endif
.PHONY: clean-old-$1-tarballs-$2
clean-old-$1-tarballs-$2:
	@# Remove all but the latest tarball
	@rm -rf $$$$(ls -t $(browsers_dir)/$1/downloads/$2/*.tar.bz2 2>/dev/null | tail -n +2)
endef
$(foreach b,$(firefox_branches),$(eval $(call fn_create_browser_target,firefox,$b)))
$(foreach b,$(seamonkey_branches),$(eval $(call fn_create_browser_target,seamonkey,$b)))

.PHONY: firefox-all
firefox-all: $(addprefix firefox-,$(firefox_branches))
.PHONY: clean-old-firefox-tarballs
clean-old-firefox-tarballs: \
		$(addprefix clean-old-firefox-tarballs-,$(firefox_branches))
.PHONY: clean-old-browser-tarballs
clean-old-browser-tarballs: \
		clean-old-firefox-tarballs

#===============================================================================
# Running and Testing RequestPolicy
#===============================================================================

#-------------------------------------------------------------------------------
# [VARIABLES] general variables
#-------------------------------------------------------------------------------

# select the default app. Can be overridden e.g. via `make run app='seamonkey'`
app := firefox
# default app branch
ifeq ($(app),firefox)
	app_branch := nightly
else
	app_branch := release
endif
binary_filename := $(app)
app_binary := dev_env/browsers/$(app)/extracted/$(app_branch)/$(binary_filename)

mozrunner_prefs_ini := tests/mozrunner-prefs.ini

#-------------------------------------------------------------------------------
# run firefox
#-------------------------------------------------------------------------------

# arguments for mozrunner
run_additional_xpis :=
_run_xpis := $(xpi_file__unit_testing) $(xpi_file__dev_helper) $(run_additional_xpis)
run_additional_prefs := default
_run_prefs  := common run $(run_additional_prefs)
run_additional_args :=
_run_mozrunner_args := \
	$(addprefix --addon=,$(_run_xpis)) \
	--binary=$(app_binary) \
	$(addprefix  --preferences=$(mozrunner_prefs_ini):,$(_run_prefs)) \
	$(run_additional_args)

.PHONY: run
run: python-venv unit-testing-xpi dev-helper-xpi $(app_binary)
	$(call IN_PYTHON_ENV, \
		mozrunner $(_run_mozrunner_args) \
	)

#-------------------------------------------------------------------------------
# unit testing: Marionette
#-------------------------------------------------------------------------------

# Note: currently you have to do some setup before this will work.
# see https://github.com/RequestPolicyContinued/requestpolicy/wiki/Setting-up-a-development-environment#unit-tests-for-requestpolicy

.PHONY: check test marionette
check test: marionette

logfile_prefix := $(shell date +%y%m%d-%H%M%S)-$(app_branch)-

marionette_tests := tests/marionette/rp_puppeteer/tests/manifest.ini
marionette_tests += tests/marionette/tests/manifest.ini

_marionette_gecko_log := $(logs_dir)/$(logfile_prefix)marionette.gecko.log
marionette_logging := --gecko-log=$(_marionette_gecko_log)
marionette_logging += --log-html=$(logs_dir)/$(logfile_prefix)marionette.html
marionette_logging += --log-tbpl=$(logs_dir)/$(logfile_prefix)marionette.tbpl.log
#marionette_logging += --log-raw=$(logs_dir)/$(logfile_prefix)marionette.raw.log
#marionette_logging += --log-xunit=$(logs_dir)/$(logfile_prefix)marionette.xunit.xml
#marionette_logging += --log-mach=$(logs_dir)/$(logfile_prefix)marionette.mach.log
#marionette_logging += --log-unittest=$(logs_dir)/$(logfile_prefix)marionette.unittest.log

# localhost:28xxx
_marionette_port := 28$(shell printf "%03d" `printenv DISPLAY | cut -c 2-`)
_marionette_address := localhost:$(_marionette_port)

_marionette_xpis := $(xpi_file__unit_testing) $(xpi_file__dev_helper)
_marionette_prefs := common marionette
_marionette_mozprofile_args := \
	$(addprefix --addon=,$(_marionette_xpis)) \
	$(addprefix  --preferences=$(mozrunner_prefs_ini):,$(_marionette_prefs))
marionette_additional_args :=
_marionette_runtests_args := \
	--binary=$(app_binary) \
	--profile="$$profile_dir" \
	--address=$(_marionette_address) \
	$(marionette_logging) \
	$(marionette_additional_args) \
	$(marionette_tests)

.PHONY: marionette
marionette: python-venv \
		$(logs_dir) \
		unit-testing-xpi \
		dev-helper-xpi \
		dummy-xpi \
		webext-apply-css-xpi \
		specific-xpi \
		amo-nightly-xpi \
		$(app_binary)
	@# Due to Mozilla Bug 1315522, the profile needs to be created and
	@# removed directly.
	$(call IN_PYTHON_ENV, \
	$(call WITH_MOZPROFILE,profile_dir,$(_marionette_mozprofile_args), \
		./tests/marionette/rp_ui_harness/runtests.py \
			$(_marionette_runtests_args) ; \
	))
	@echo "Checking for undetected errors"
	./scripts/check_gecko_log.py -p $(_marionette_gecko_log)

#-------------------------------------------------------------------------------
# static code analysis
#-------------------------------------------------------------------------------

jshint_args :=
jscs_args :=

.PHONY: static-analysis jshint jscs addons-linter
static-analysis: jshint jscs addons-linter check-locales
jshint: node-packages
	$(JSHINT) --exclude '**/jquery.min.js' $(jshint_args) src/
	$(JSHINT) $(jshint_args) tests/xpcshell/
	$(JSHINT) $(jshint_args) tests/helper-addons/
jscs: node-packages
	@echo '** NOTICE ** jscs is not run on "ruleset.jsm" because of its "yield" statement.'
	cd src/; $(JSCS) $(jscs_args) .
	cd tests/xpcshell/; $(JSCS) $(jscs_args) .
	cd tests/helper-addons/; $(JSCS) $(jscs_args) .
addons-linter: nightly-xpi node-packages
	$(ADDONS_LINTER) $(xpi_file__nightly)
# localization checks
include tests/l10n/Makefile


#===============================================================================
# other targets
#===============================================================================

# Cleanup targets
.PHONY: clean mostlyclean distclean clean-dev-environment
clean: clean-old-browser-tarballs
	@rm -rf $(dist_dir)/*.xpi
	@-$(call _remove_all_files_and_dirs_in,$(build_dir_root))
mostlyclean: clean
	@-$(call _remove_all_files_and_dirs_in,$(logs_dir))
clean-dev-environment:
	@-$(call _remove_all_files_and_dirs_in,$(python_env_dir))
	@-$(call _remove_all_files_and_dirs_in,$(node_env_dir)/node_modules)
	@rm -rf $(browsers_dir)/firefox
	@# Do not remove the seamonkey "downloads" dir. Seamonkey tarballs
	@# are put there manually.
	@rm -rf $(browsers_dir)/seamonkey/extracted
distclean: mostlyclean clean-dev-environment

# Can force a target to be executed every time.
.PHONY: FORCE
FORCE:
