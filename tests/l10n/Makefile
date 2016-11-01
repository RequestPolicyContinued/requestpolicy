BASE_DIR := $(CURDIR)
L10N_DIR := $(BASE_DIR)/src/locale

reference_locale := en-US
all_locales := $(patsubst $(L10N_DIR)/%,%,$(wildcard $(L10N_DIR)/*))
ifeq "$(all_locales)" ""
$(error No locales found in $(L10N_DIR)!)
endif

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
	@$(BASE_DIR)/tests/l10n/check-dtd-file.sh \
	  "$(L10N_DIR)/$(1)/requestpolicy.dtd" \
	  "$(L10N_DIR)/$(reference_locale)/requestpolicy.dtd"
endef
$(foreach l,$(all_locales),$(eval $(call fn_create_check_locale,$l)))

#-------------------------------------------------------------------------------
# main target
#-------------------------------------------------------------------------------

.PHONY: check-locales
check-locales: $(check_locale_targets)
