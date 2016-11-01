BASE_DIR := $(CURDIR)
L10N_DIR := $(BASE_DIR)/src/locale

reference_locale := en-US
all_locales := $(patsubst $(L10N_DIR)/%,%,$(wildcard $(L10N_DIR)/*))

fail = (echo "$(1)" && exit 1)

#-------------------------------------------------------------------------------
# per-locale targets
#-------------------------------------------------------------------------------

check_locale_targets :=

define fn_create_check_locale
check_locale_targets += check-locale-$(1)
.PHONY: check-locale-$(1)
check-locale-$(1):
	@$(BASE_DIR)/tests/l10n/check-property-file.sh \
	  "$(L10N_DIR)/$(1)/requestpolicy.properties" \
	  "$(L10N_DIR)/$(reference_locale)/requestpolicy.properties"
endef
$(foreach l,$(all_locales),$(eval $(call fn_create_check_locale,$l)))

#-------------------------------------------------------------------------------
# main target
#-------------------------------------------------------------------------------

.PHONY: check-locales check-locales-variable
check-locales: check-locale-variables $(check_locale_targets)
check-locale-variables:
	@test "$(all_locales)" != "" || \
	  $(call fail,No locales found in $(L10N_DIR)!)
