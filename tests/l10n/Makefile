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

check_legacy_locale_targets :=

define fn_create_check_legacy_locale
check_legacy_locale_targets += check-legacy-locale-$(1)
.PHONY: check-legacy-locale-$(1)
ifeq "$(1)" "$(reference_locale)"
check-legacy-locale-$(1):
else
check-legacy-locale-$(1): check-legacy-locale-$(reference_locale)
endif
	@$(BASE_DIR)/tests/l10n/check-dtd-file.sh \
	  "$(L10N_DIR)/$(1)/requestpolicy.dtd" \
	  "$(L10N_DIR)/$(reference_locale)/requestpolicy.dtd"
endef
$(foreach l,$(all_locales),$(eval $(call fn_create_check_legacy_locale,$l)))

#-------------------------------------------------------------------------------
# main target
#-------------------------------------------------------------------------------

.PHONY: check-legacy-locales
check-legacy-locales: $(check_legacy_locale_targets)
