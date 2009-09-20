# Note: in addition to packages available from one's Linux distro, the required
# files can be obtained by downloading the SDK from:
# https://developer.mozilla.org/en/Gecko_SDK

IDLC=/usr/local/xulrunner-sdk/bin/xpidl
INC=/usr/local/xulrunner-sdk/idl
XPTS=nsIRequestPolicy.xpt

all: $(XPTS)

%.xpt: %.idl
	$(IDLC) -m typelib -w -v -I $(INC) -e $(@) $(<)
