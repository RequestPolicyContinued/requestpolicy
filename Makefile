# NOTE: in this file tab indentation is used.
# Otherwise .RECIPEPREFIX would have to be set.


# ==============================================================================
# create variables
# ==============================================================================

# _________________
# general variables
#

SHELL := /bin/bash

extension_name := requestpolicy

amo__extension_id     := rpcontinued@requestpolicy.org
off_amo__extension_id := rpcontinued@non-amo.requestpolicy.org


# ____________________________________
# generating XPIs -- general variables
#

# The zip application to be used.
ZIP := zip
PREPROCESS := /usr/bin/preprocess --content-types-path build/preprocess-content-types.txt

source_dirname := src
build_dirname := build
dist_dirname := dist

source_path := $(source_dirname)/
dist_path := $(dist_dirname)/


# _____________________________________________
# RequestPolicy XPI -- collect the files' paths
#

# files which are simply copied
src__copy_files := \
		$(source_dirname)/chrome.manifest \
		$(source_dirname)/install.rdf \
		$(source_dirname)/README \
		$(source_dirname)/LICENSE \
		$(wildcard $(source_dirname)/content/settings/*.css) \
		$(wildcard $(source_dirname)/content/settings/*.html) \
		$(wildcard $(source_dirname)/content/*.html) \
		$(wildcard $(source_dirname)/content/ui/*.xul) \
		$(wildcard $(source_dirname)/locale/*/*.dtd) \
		$(wildcard $(source_dirname)/locale/*/*.properties) \
		$(wildcard $(source_dirname)/skin/*.css) \
		$(wildcard $(source_dirname)/skin/*.png) \
		$(wildcard $(source_dirname)/skin/*.svg) \
		$(shell find $(source_dirname) -type f -iname "jquery*.js")

# JavaScript files which will be (pre)processed.
# The `copy_files` will be filtered out.
src__jspp_files := \
		$(filter-out $(src__copy_files), \
				$(shell find $(source_dirname) -type f -regex ".*\.jsm?") \
		)

# all source files
src__all_files := $(src__copy_files) $(src__jspp_files)


# Create generic variables without path prefixs.
rp_all_files  := $(patsubst $(source_path)%,%,$(src__all_files))
rp_jspp_files := $(patsubst $(source_path)%,%,$(src__jspp_files))
rp_copy_files := $(patsubst $(source_path)%,%,$(src__copy_files))

rp_deleted_files :=
rp_empty_dirs :=

# _____________________________________
# vars for generating the "off-AMO" XPI
#

off_amo__build_path := $(build_dirname)/off-amo/

off_amo__xpi_file := $(dist_path)$(extension_name).xpi

off_amo__all_files  := $(addprefix $(off_amo__build_path),$(rp_all_files))
off_amo__jspp_files := $(addprefix $(off_amo__build_path),$(rp_jspp_files))
off_amo__copy_files := $(addprefix $(off_amo__build_path),$(rp_copy_files))


# detect deleted files and empty directories
off_amo__deleted_files :=
off_amo__empty_dirs :=
ifneq "$(wildcard $(off_amo__build_path))" ""
# files that have been deleted but still exist in the build directory.
off_amo__deleted_files := $(shell find $(off_amo__build_path) -type f | \
		grep -v "META-INF" | \
		grep -F -v $(addprefix -e ,$(off_amo__all_files)))
# empty directories. -mindepth 1 to exclude the build directory itself.
off_amo__empty_dirs := $(shell find $(off_amo__build_path) -mindepth 1 -type d -empty)
endif
rp_deleted_files += $(off_amo__deleted_files)
rp_empty_dirs += $(off_amo__empty_dirs)


# __________________________________________
# vars for generating a signed "off-AMO" XPI
#

signed_xpi_file := $(dist_path)$(extension_name)-signed.xpi


# _________________________________
# vars for generating the "AMO" XPI
#

amo__build_path := $(build_dirname)/amo/

amo__xpi_file := $(dist_path)$(extension_name)-amo.xpi

amo__all_files  := $(addprefix $(amo__build_path),$(rp_all_files))
amo__jspp_files := $(addprefix $(amo__build_path),$(rp_jspp_files))
amo__copy_files := $(addprefix $(amo__build_path),$(rp_copy_files))


# detect deleted files and empty directories
amo__deleted_files :=
amo__empty_dirs :=
ifneq "$(wildcard $(amo__build_path))" ""
# files that have been deleted but still exist in the build directory.
amo__deleted_files := \
		$(shell find $(amo__build_path) -type f | \
		grep -v "META-INF" | \
		grep -F -v $(addprefix -e ,$(amo__all_files)))
# empty directories. -mindepth 1 to exclude the build directory itself.
amo__empty_dirs := $(shell find $(amo__build_path) -mindepth 1 -type d -empty)
endif
rp_deleted_files += $(amo__deleted_files)
rp_empty_dirs += $(amo__empty_dirs)


# ________________________________________
# vars for generating the unit-testing XPI
#

unit_testing__build_path := $(build_dirname)/unit-testing/

unit_testing__xpi_file := $(dist_path)$(extension_name)-unit-testing.xpi

unit_testing__all_files  := $(addprefix $(unit_testing__build_path),$(rp_all_files))
unit_testing__jspp_files := $(addprefix $(unit_testing__build_path),$(rp_jspp_files))
unit_testing__copy_files := $(addprefix $(unit_testing__build_path),$(rp_copy_files))


# detect deleted files and empty directories
unit_testing__deleted_files :=
unit_testing__empty_dirs :=
ifneq "$(wildcard $(unit_testing__build_path))" ""
# files that have been deleted but still exist in the build directory.
unit_testing__deleted_files := \
		$(shell find $(unit_testing__build_path) -type f | \
		grep -v "META-INF" | \
		grep -F -v $(addprefix -e ,$(unit_testing__all_files)))
# empty directories. -mindepth 1 to exclude the build directory itself.
unit_testing__empty_dirs := $(shell find $(unit_testing__build_path) -mindepth 1 -type d -empty)
endif
rp_deleted_files += $(unit_testing__deleted_files)
rp_empty_dirs += $(unit_testing__empty_dirs)


# ______________________________________
# vars for generating the Dev Helper XPI
#

dev_helper__source_dirname := tests/helper-addons/dev-helper
dev_helper__source_path := $(dev_helper__source_dirname)/

dev_helper__src__all_files := $(shell find $(dev_helper__source_dirname) -type f -regex ".*\.jsm?") \
		$(dev_helper__source_dirname)/chrome.manifest \
		$(dev_helper__source_dirname)/install.rdf

dev_helper__xpi_file := $(dist_path)rpc-dev-helper.xpi


# _________________________________
# vars for generating the Dummy XPI
#

dummy_ext__source_dirname := tests/helper-addons/dummy-ext
dummy_ext__source_path := $(dummy_ext__source_dirname)/

dummy_ext__src__all_files := $(shell find $(dummy_ext__source_dirname) -type f -regex ".*\.jsm?") \
		$(dummy_ext__source_dirname)/install.rdf

dummy_ext__xpi_file := $(dist_path)dummy-ext.xpi


# ______________________________
# vars for mozrunner and mozmill
#

# the default XPI to use for mozrunner and mozmill
moz_xpi := $(unit_testing__xpi_file)

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

# __________________
# vars for mozrunner
#

mozrunner_prefs_ini := tests/mozrunner-prefs.ini



# ==============================================================================
# define targets
# ==============================================================================

.PHONY: all build dist sign

# set "all" to be the default target
.DEFAULT_GOAL := all

# building means to prepare all files in the build directory
build: $(off_amo__build_path)

# build and create XPI file
all: $(off_amo__xpi_file)
	@echo "Build finished successfully."
dist xpi: $(off_amo__xpi_file)

# create the dist directory
$(dist_path):
	@mkdir -p $(dist_path)

signed-xpi: $(signed_xpi_file)

.PHONY: preprocessor
preprocessor: $(build_dirname)/preprocess-content-types.txt
$(build_dirname)/preprocess-content-types.txt:
	echo 'JavaScript .jsm' > $@


# ________________________
# create the "off-AMO" XPI
#

# Note: Here the build path is added as a prerequisite, *not* the
#       phony "build" target. This avoids re-packaging in case
#       nothing has changed.
#       Also $(off_amo__all_files) is needed as prerequisite, so that the
#       xpi gets updated.
$(off_amo__xpi_file): $(off_amo__build_path) $(off_amo__all_files) | $(dist_path)
	@rm -f $(off_amo__xpi_file)
	@echo "Creating XPI file."
	@cd $(off_amo__build_path) && \
	$(ZIP) $(abspath $(off_amo__xpi_file)) $(rp_all_files)
	@echo "Creating XPI file: Done!"

# _______________________________
# create the signed "off-AMO" XPI
#

$(signed_xpi_file): $(off_amo__build_path) $(off_amo__all_files) $(off_amo__build_path)/META-INF/ | $(dist_path)
	@rm -f $(signed_xpi_file)
	@cd $(off_amo__build_path) && \
	$(ZIP) $(abspath $(signed_xpi_file)) \
		META-INF/zigbert.rsa && \
	$(ZIP) -r -D $(abspath $(signed_xpi_file)) \
		$(rp_all_files) META-INF \
		-x META-INF/zigbert.rsa

# ____________________
# create the "AMO" XPI
#

amo-xpi $(amo__xpi_file): $(amo__build_path) $(amo__all_files) | $(dist_path)
	@rm -f $(amo__xpi_file)
	@echo "Creating AMO XPI."
	@cd $(amo__build_path) && \
	$(ZIP) $(abspath $(amo__xpi_file)) $(rp_all_files)
	@echo "Creating AMO XPI: Done!"

# ___________________________
# create the unit-testing XPI
#

unit-testing-xpi $(unit_testing__xpi_file): $(unit_testing__build_path) $(unit_testing__all_files) | $(dist_path)
	@rm -f $(unit_testing__xpi_file)
	@echo "Creating unit-testing XPI."
	@cd $(unit_testing__build_path) && \
	$(ZIP) $(abspath $(unit_testing__xpi_file)) $(rp_all_files)
	@echo "Creating unit-testing XPI: Done!"


# _________________________
# create the Dev Helper XPI
#

# For now use FORCE, i.e. create the XPI every time. If the
# 'FORCE' should be removed, deleted files have to be detected,
# just like for the other XPIs.
dev-helper-xpi $(dev_helper__xpi_file): $(dev_helper__src__all_files) FORCE | $(dist_path)
	@rm -f $(dev_helper__xpi_file)
	@echo "Creating 'RPC Dev Helper' XPI."
	@cd $(dev_helper__source_dirname) && \
	$(ZIP) $(abspath $(dev_helper__xpi_file)) $(patsubst $(dev_helper__source_path)%,%,$(dev_helper__src__all_files))
	@echo "Creating 'RPC Dev Helper' XPI: Done!"


# ____________________
# create the Dummy XPI
#

# For now use FORCE, i.e. create the XPI every time. If the
# 'FORCE' should be removed, deleted files have to be detected,
# just like for the other XPIs.
dummy-xpi $(dummy_ext__xpi_file): $(dummy_ext__src__all_files) FORCE | $(dist_path)
	@rm -f $(dummy_ext__xpi_file)
	@echo "Creating 'Dummy' XPI."
	@cd $(dummy_ext__source_dirname) && \
	$(ZIP) $(abspath $(dummy_ext__xpi_file)) $(patsubst $(dummy_ext__source_path)%,%,$(dummy_ext__src__all_files))
	@echo "Creating 'Dummy' XPI: Done!"


# _________________________________________
# create the XPI from any tag or any commit
#

# Default tree-ish.
specific_xpi__treeish := v1.0.beta9.3__preprocess.py

specific_xpi__file := $(dist_path)$(extension_name)-$(specific_xpi__treeish).xpi
specific_xpi__build_path := $(build_dirname)/specific-xpi

# create the XPI only if it doesn't exist yet
.PHONY: specific-xpi
specific-xpi: $(specific_xpi__file)

$(specific_xpi__file):
	@# remove the build directory (if it exists) and recreate it
	rm -rf $(specific_xpi__build_path)
	mkdir -p $(specific_xpi__build_path)

	@# copy the content of the tree-ish to the build dir
	@# see https://stackoverflow.com/questions/160608/do-a-git-export-like-svn-export/9416271#9416271
	git archive $(specific_xpi__treeish) | (cd $(specific_xpi__build_path); tar x)

	@# run `make` in the build directory
	(cd $(specific_xpi__build_path); make)

	@# move the created XPI from the build directory to the actual
	@# dist directory
	mv $(specific_xpi__build_path)/dist/*.xpi $(specific_xpi__file)

# ______________________________________
# create the files for the "off-AMO" XPI
#

# Process all source files and, if necessary, delete all
# empty directories and deleted files from the build directory.
$(off_amo__build_path): $(off_amo__all_files) $(off_amo__deleted_files) $(off_amo__empty_dirs)

$(off_amo__jspp_files) : $(off_amo__build_path)% : $(source_path)% | preprocessor
	@mkdir -p $(@D)
	$(PREPROCESS) $< > $@

$(off_amo__copy_files) : $(off_amo__build_path)% : $(source_path)%
	@mkdir -p $(@D)
	@# Use `--dereference` to copy the files instead of the symlinks.
	cp --dereference $< $@

# _____________________________________________
# create the files for the signed "off-AMO" XPI
#

$(off_amo__build_path)/META-INF/: $(off_amo__build_path) $(off_amo__all_files)
	mkdir -p $(off_amo__build_path)/META-INF
	signtool -d .signing \
		-k "Open Source Developer, Martin Kimmerle's Unizeto Technologies S.A. ID" \
		$(off_amo__build_path)

# __________________________________
# create the files for the "AMO" XPI
#

$(amo__build_path): $(amo__all_files) $(amo__deleted_files) $(amo__empty_dirs)

$(amo__jspp_files) : $(amo__build_path)% : $(source_path)% | preprocessor
	@mkdir -p $(@D)
	$(PREPROCESS) -D AMO $< > $@

$(amo__copy_files) : $(amo__build_path)% : $(source_path)%
	@mkdir -p $(@D)
	cp --dereference $< $@

	@if [[ "$(notdir $@)" == "install.rdf" ]]; then \
	  echo 'using `sed` on install.rdf !' ; \
	  sed -i s/$(off_amo__extension_id)/$(amo__extension_id)/ $@ ; \
	fi

# _________________________________________
# create the files for the unit-testing XPI
#

$(unit_testing__build_path): $(unit_testing__all_files) $(unit_testing__deleted_files) $(unit_testing__empty_dirs)

$(unit_testing__jspp_files) : $(unit_testing__build_path)% : $(source_path)% | preprocessor
	@mkdir -p $(@D)
	$(PREPROCESS) --keep-lines -D UNIT_TESTING $< > $@

$(unit_testing__copy_files) : $(unit_testing__build_path)% : $(source_path)%
	@mkdir -p $(@D)
	cp --dereference $< $@

.PHONY: unit-testing-files
unit-testing-files: $(unit_testing__all_files)


# __________________
# "cleaning" targets
#

# This cleans all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -rf $(dist_dirname)/*.xpi $(build_dirname)/*
	@echo "Cleanup is done."

# remove empty directories
$(rp_empty_dirs): FORCE
	rmdir $@

# delete deleted files that still exist in the build directory.
# this target should be forced
$(rp_deleted_files): FORCE
	@# delete:
	rm $@
	@# delete parent dirs if empty:
	@rmdir --parents --ignore-fail-on-non-empty $(@D)

# ____________________________
# virtual python environments
# for running and unit-testing
#

.PHONY: venv venv-mozmill

venv: .venv/bin/activate
.venv/bin/activate: requirements.txt
	test -d .venv || virtualenv --prompt='(RP)' .venv

	@# With the `touch` command, this target is only executed
	@# when "requirements.txt" changes
	( \
	source .venv/bin/activate ; \
	pip install -r requirements.txt ; \
	touch --no-create .venv/bin/activate ; \
	)

# mozmill needs a separate venv
#   ( because it uses '==' package dependencies instead of '>='
#     see https://github.com/mozilla/mozmill/blob/2.0.10/mozmill/setup.py#L11 )
venv-mozmill: .venv-mozmill/bin/activate
.venv-mozmill/bin/activate:
	test -d .venv-mozmill || virtualenv --prompt='(RP/mozmill)' .venv-mozmill
	( \
	source .venv-mozmill/bin/activate ; \
	pip install mozmill ; \
	)

# ___________
# run firefox
#

# arguments for mozrunner
mozrunner_args := -a $(moz_xpi) -a $(dev_helper__xpi_file)
mozrunner_args += -b $(app_binary)
mozrunner_args += --preferences=$(mozrunner_prefs_ini):dev
mozrunner_args += $(moz_args)

.PHONY: run
run: venv $(moz_xpi) $(dev_helper__xpi_file)
	( \
	source .venv/bin/activate ; \
	mozrunner $(mozrunner_args) ; \
	)


# ____________
# unit testing
#

# Note: currently you have to do some setup before this will work.
# see https://github.com/RequestPolicyContinued/requestpolicy/wiki/Setting-up-a-development-environment#unit-tests-for-requestpolicy

mozmill_tests_dir := .mozilla/mozmill-tests
mozmill_rpc_test_dir := $(mozmill_tests_dir)/firefox/tests/addons/rpcontinued@requestpolicy.org

# Default mozmill manifest to use for testing
mm_manifest := manifest.ini

.PHONY: check test mozmill marionette mozmill-dirs
check test: mozmill marionette

mozmill: venv-mozmill $(moz_xpi) $(dev_helper__xpi_file) mozmill-dirs
	( \
	source .venv-mozmill/bin/activate ; \
	mozmill -a $(moz_xpi) -a $(dev_helper__xpi_file) -b $(app_binary) \
		-m $(mozmill_rpc_test_dir)/$(mm_manifest) $(moz_args) ; \
	)



mozmill-dirs: $(mozmill_tests_dir) \
	$(mozmill_rpc_test_dir) \
	$(mozmill_rpc_test_dir)/mozmill-tests \
	$(mozmill_rpc_test_dir)/data

$(mozmill_rpc_test_dir): $(mozmill_tests_dir)
	@test -L $@ \
	|| ln -ns ../../../../../tests/mozmill $@

$(mozmill_rpc_test_dir)/mozmill-tests: $(mozmill_rpc_test_dir)
	@test -L tests/mozmill/mozmill-tests \
	|| ln -ns ../../$(mozmill_tests_dir) tests/mozmill/mozmill-tests

$(mozmill_rpc_test_dir)/data: $(mozmill_rpc_test_dir)
	@test -L tests/mozmill/data \
	|| ln -ns ../../ tests/mozmill/data



marionette_tests := tests/marionette/rp_puppeteer/tests/manifest.ini
marionette_tests += tests/marionette/tests/manifest.ini

marionette_prefs :=

.PHONY: marionette
marionette: venv \
		unit-testing-xpi \
		dev-helper-xpi \
		dummy-xpi \
		specific-xpi \
		amo-xpi
	@# Due to Mozilla Bug 1173502, the profile needs to be created and
	@# removed directly.
	( \
	source .venv/bin/activate ; \
	export PYTHONPATH=tests/marionette/ ; \
	profile_dir=`mozprofile -a $(unit_testing__xpi_file) -a $(dev_helper__xpi_file) --preferences=$(mozrunner_prefs_ini):marionette` ; \
	firefox-ui-functional --binary=$(app_binary) --profile=$$profile_dir $(marionette_prefs) $(marionette_tests) ; \
	rm -rf $$profile_dir ; \
	)

# ____________________
# static code analysis
#

.PHONY: static-analysis jshint
static-analysis: jshint jscs
jshint:
	jshint --extra-ext jsm --exclude '**/jquery.min.js' src/
jscs:
	jscs src/

# ________________
# "helper" targets
#

.PHONY: FORCE
FORCE:
