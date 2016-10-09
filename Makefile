# NOTE: in this file tab indentation is used.
# Otherwise .RECIPEPREFIX would have to be set.


#===============================================================================
# general variables and targets
#===============================================================================

SHELL      := /bin/bash
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

.DEFAULT_GOAL := all

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
		$(source_dir)/install.rdf \
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

# JavaScript files which will be (pre)processed.
# The `copy_files` will be filtered out.
src__jspp_files := \
		$(filter-out $(src__copy_files), \
				$(shell find $(source_dir) -type f -regex ".*\.jsm?") \
		)

# all source files
src__all_files := $(src__copy_files) $(src__jspp_files)

#-------------------------------------------------------------------------------
# [VARIABLES] paths in the "build" directory
#-------------------------------------------------------------------------------

current_build_dir := $(build_dir_root)/$(BUILD)

build__all_files  := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__all_files))
build__jspp_files := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__jspp_files))
build__copy_files := $(patsubst $(source_dir)/%,$(current_build_dir)/%,$(src__copy_files))

# detect deleted files and empty directories
ifdef BUILD
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

	@if [[ "$(notdir $@)" == "install.rdf" ]]; then \
		if [[ "$(current_build__extension_id)" == "$(amo__extension_id)" ]]; then \
	  		echo 'install.rdf: changing the Extension ID !' ; \
	  		sed -i s/$(off_amo__extension_id)/$(amo__extension_id)/ $@ ; \
	  		echo 'install.rdf: removing the updateURL !' ; \
	  		sed -i '/<em:updateURL>.*<\/em:updateURL>/d' $@ ; \
		fi ; \
		if [[ "$(current_build__unique_version)" == "yes" ]]; then \
	  		echo 'install.rdf: making the version unique !' ; \
				rev_count=`$(GIT) rev-list HEAD | wc --lines` ; \
				commit_sha=`$(GIT) rev-parse --short HEAD` ; \
				unique_suffix=.$${rev_count}.r$${commit_sha}.pre ; \
	  		sed -i 's,\(</em:version>\),'$${unique_suffix}'\1,' $@ ; \
		fi ; \
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

other_build__alias       := $(alias__$(OTHER_BUILD))
other_build__source_path := $(source_path__$(OTHER_BUILD))
other_build__xpi_file    := $(xpi_file__$(OTHER_BUILD))

#-------------------------------------------------------------------------------
# [VARIABLES] collect source files
#-------------------------------------------------------------------------------

other_build__src__all_files := $(shell find $(other_build__source_path) -type f)

#-------------------------------------------------------------------------------
# TARGETS
#-------------------------------------------------------------------------------

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
app_binary := .mozilla/software/$(app)/$(app_branch)/$(binary_filename)

mozrunner_prefs_ini := tests/mozrunner-prefs.ini

#-------------------------------------------------------------------------------
# virtual python environments
#-------------------------------------------------------------------------------

.PHONY: venv
venv: .venv/requirements
.venv/requirements: requirements.txt | .venv/bin/activate
	source $| ; pip install -r $<
	touch $@
.venv/bin/activate:
	virtualenv --prompt='(RP)' .venv

#-------------------------------------------------------------------------------
# run firefox
#-------------------------------------------------------------------------------

# arguments for mozrunner
run_additional_xpis :=
run_xpis := $(xpi_file__unit_testing) $(xpi_file__dev_helper) $(run_additional_xpis)
run_additional_args :=
run_args := $(addprefix -a ,$(run_xpis))
run_args += -b $(app_binary)
run_args += --preferences=$(mozrunner_prefs_ini):dev
run_args += $(run_additional_args)

.PHONY: run
run: venv unit-testing-xpi dev-helper-xpi
	source .venv/bin/activate ; mozrunner $(run_args)

#-------------------------------------------------------------------------------
# unit testing: Marionette
#-------------------------------------------------------------------------------

# Note: currently you have to do some setup before this will work.
# see https://github.com/RequestPolicyContinued/requestpolicy/wiki/Setting-up-a-development-environment#unit-tests-for-requestpolicy

.PHONY: check test marionette
check test: marionette

marionette_tests := tests/marionette/rp_puppeteer/tests/manifest.ini
marionette_tests += tests/marionette/tests/manifest.ini

marionette_logging := --gecko-log=$(logs_dir)/marionette.gecko.log
marionette_logging += --log-html=$(logs_dir)/marionette.html
marionette_logging += --log-tbpl=$(logs_dir)/marionette.tbpl.log
#marionette_logging += --log-raw=$(logs_dir)/marionette.raw.log
#marionette_logging += --log-xunit=$(logs_dir)/marionette.xunit.xml
#marionette_logging += --log-mach=$(logs_dir)/marionette.mach.log
#marionette_logging += --log-unittest=$(logs_dir)/marionette.unittest.log

marionette_prefs :=

.PHONY: marionette
marionette: venv \
		$(logs_dir) \
		unit-testing-xpi \
		dev-helper-xpi \
		dummy-xpi \
		webext-apply-css-xpi \
		specific-xpi \
		amo-nightly-xpi
	@# Due to Mozilla Bug 1173502, the profile needs to be created and
	@# removed directly.
	( \
	source .venv/bin/activate ; \
	export PYTHONPATH=tests/marionette/ ; \
	profile_dir=`mozprofile -a $(xpi_file__unit_testing) -a $(xpi_file__dev_helper) --preferences=$(mozrunner_prefs_ini):marionette` ; \
	./tests/marionette/rp_ui_harness/runtests.py \
		--binary=$(app_binary) --profile=$$profile_dir \
		$(marionette_logging) $(marionette_prefs) $(marionette_tests) ; \
	exit_status=$$? ; \
	rm -rf $$profile_dir ; \
	exit $$exit_status \
	)

#-------------------------------------------------------------------------------
# static code analysis
#-------------------------------------------------------------------------------

jshint_args :=
jscs_args :=

.PHONY: static-analysis jshint jscs addons-linter
static-analysis: jshint jscs addons-linter
jshint:
	jshint --extra-ext jsm --exclude '**/jquery.min.js' $(jshint_args) src/
	jshint $(jshint_args) tests/xpcshell/
	jshint $(jshint_args) tests/helper-addons/
jscs:
	@echo '** NOTICE ** jscs is not run on "ruleset.jsm" because of its "yield" statement.'
	cd src/; jscs $(jscs_args) .
	cd tests/xpcshell/; jscs $(jscs_args) .
	cd tests/helper-addons/; jscs $(jscs_args) .
addons-linter: nightly-xpi
	addons-linter $(xpi_file__nightly)


#===============================================================================
# other targets
#===============================================================================

# Clean all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -rf $(dist_dir)/*.xpi
	@rm -rf $(build_dir_root)/*
	@rm -rf $(logs_dir)/*
	@echo "Cleanup is done."

# Can force a target to be executed every time.
.PHONY: FORCE
FORCE:
