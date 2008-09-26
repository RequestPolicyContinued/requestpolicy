IDLC=/usr/lib/xulrunner/xpidl
INC=/usr/lib/xulrunner/sdk/idl
XPTS=csrpolicy.xpt

all: $(XPTS)

%.xpt: %.idl
	$(IDLC) -m typelib -w -v -I $(INC) -e $(@) $(<)

