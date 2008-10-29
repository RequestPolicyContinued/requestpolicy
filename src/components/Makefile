IDLC=/usr/lib/xulrunner/xpidl
INC=/usr/lib/xulrunner/sdk/idl
XPTS=nsIRequestPolicy.xpt

all: $(XPTS)

%.xpt: %.idl
	$(IDLC) -m typelib -w -v -I $(INC) -e $(@) $(<)

