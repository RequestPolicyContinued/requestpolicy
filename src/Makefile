extension_name := requestpolicy
extension_uuid := requestpolicy@requestpolicy.com

# The zip application to be used.
ZIP := zip

# The target location of the build and build files.
dist_dir := dist

# The target XPI file.
xpi_file := $(dist_dir)/$(extension_name).xpi

# This builds the extension XPI file.
.PHONY: all
all: $(xpi_file)
	@echo
	@echo "Build finished successfully."
	@echo

# This cleans all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -f $(xpi_file)
	@echo "Cleanup is done."

# The sources for the XPI file.
xpi_built := bootstrap.js \
             chrome.manifest \
             install.rdf \
             LICENSE \
             README \
             $(wildcard content/lib/*.js) \
             $(wildcard content/lib/*.jsm) \
             $(wildcard content/settings/*.css) \
             $(wildcard content/settings/*.html) \
             $(wildcard content/settings/*.js) \
             $(wildcard content/ui/*.js) \
             $(wildcard content/ui/*.xul) \
             $(wildcard content/*.js) \
             $(wildcard locale/*/*.dtd) \
             $(wildcard locale/*/*.properties) \
             $(wildcard skin/*.css) \
             $(wildcard skin/*.png) \
             $(wildcard skin/*.svg)

# clean every time. This is needed for the case that files have been removed or
# renamed. TODO: Find a nicer solution.
$(xpi_file): $(xpi_built) clean
	@echo "Creating XPI file."
	@$(ZIP) $(xpi_file) $(xpi_built)
	@echo "Creating XPI file. Done!"
