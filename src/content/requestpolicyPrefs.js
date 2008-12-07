Components.utils.import("resource://requestpolicy/Logger.jsm");

var requestpolicyPrefs = {

  _initialized : false,
  _requestpolicy : null,

  // For things we can't do through the nsIRequestPolicy interface, use direct
  // access to the underlying JS object.
  _requestpolicyJSObject : null,

  _originsList : null,
  _destinationsList : null,
  _originsToDestinationsList : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._requestpolicy = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._requestpolicyJSObject = this._requestpolicy.wrappedJSObject;

      this._originsList = document.getElementById("originsList");
      this._destinationsList = document.getElementById("destinationsList");
      this._originsToDestinationsList = document
          .getElementById("originsToDestinationsList");

      // Each list has a "removeButton" property which is the list's associated
      // "remove selected items" button.
      this._originsList.removeButton = document.getElementById("removeOrigins");
      this._destinationsList.removeButton = document
          .getElementById("removeDestinations");
      this._originsToDestinationsList.removeButton = document
          .getElementById("removeOriginsToDestinations");

      // Each "remove selected items" button has a "listbox" property which is
      // the button's associated list.
      this._originsList.removeButton.listbox = this._originsList;
      this._destinationsList.removeButton.listbox = this._destinationsList;
      this._originsToDestinationsList.removeButton.listbox = this._originsToDestinationsList;

      // Each list has a "forbid" function to remove an item from the list.
      this._originsList.forbid = function(origin) {
        requestpolicyPrefs._requestpolicyJSObject.forbidOrigin(origin);
      };
      this._destinationsList.forbid = function(destination) {
        requestpolicyPrefs._requestpolicyJSObject
            .forbidDestination(destination);
      };
      this._originsToDestinationsList.forbid = function(originToDestIdentifier) {
        requestpolicyPrefs._requestpolicyJSObject
            ._forbidOriginToDestinationByCombinedIdentifier(originToDestIdentifier);
      };

      this._populateWhitelists();
    }
  },

  /**
   * Updates the status bar icons in each window.
   */
  statusbarIconChanged : function(iconStyle) {
    for (var i = 0; i < Application.windows.length; i++) {
      // It seems that _window should be treated as privite, but it's there and
      // it is what we want.
      var window = Application.windows[i]._window;
      if (window.requestpolicyOverlay) {
        window.requestpolicyOverlay.setStatusbarIconStyle(iconStyle);
      }
    }
  },

  _populateWhitelists : function() {
    // Origins.
    var origins = [];
    for (var i in this._requestpolicyJSObject._allowedOrigins) {
      origins.push([i, false]);
    }
    for (var i in this._requestpolicyJSObject._temporarilyAllowedOrigins) {
      origins.push([i, true]);
    }
    origins.sort(function(a, b) {
          return a[0].localeCompare(b[0]);
        });
    this._populateListboxFromObjectProperties(this._originsList, origins);

    // Destinations.
    var destinations = [];
    for (var i in this._requestpolicyJSObject._allowedDestinations) {
      destinations.push([i, false]);
    }
    for (var i in this._requestpolicyJSObject._temporarilyAllowedDestinations) {
      destinations.push([i, true]);
    }
    destinations.sort(function(a, b) {
          return a[0].localeCompare(b[0]);
        });
    this._populateListboxFromObjectProperties(this._destinationsList,
        destinations);

    // Origins to destinations.
    var originsToDestinations = [];
    for (var i in this._requestpolicyJSObject._allowedOriginsToDestinations) {
      var parts = i.split("|");
      originsToDestinations.push([parts[0], parts[1], false]);
    }
    for (var i in this._requestpolicyJSObject._temporarilyAllowedOriginsToDestinations) {
      var parts = i.split("|");
      originsToDestinations.push([parts[0], parts[1], i, true]);
    }
    originsToDestinations.sort(function(a, b) {
          var firstComp = a[0].localeCompare(b[0]);
          return firstComp ? firstComp : a[1].localeCompare(b[1]);
        });
    this._populateListboxFromTwoPartObjectProperties(
        this._originsToDestinationsList, originsToDestinations);
  },

  _populateListboxFromObjectProperties : function(listbox, items) {
    // The arrays are formatted as: [identifier, temporary]
    for (var i = 0; i < items.length; i++) {
      // This label goes in an implicit first cell.
      var item = listbox.appendItem(items[i][0], items[i][0]);
      // Add cell indicating whether it is a temporary permission.
      item.appendChild(this._createTemporaryPermissionsCell(items[i][1]));
    }
  },

  _populateListboxFromTwoPartObjectProperties : function(listbox, items) {
    // The arrays are formatted as: [origin, dest, identifier, temporary]
    for (var i = 0; i < items.length; i++) {
      // This label (the origin) goes in an implicit first cell.
      var item = listbox.appendItem(items[i][0], items[i][2]);
      // Create a cell for the "destination" indicator.
      var cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][1]);
      item.appendChild(cell);
      // Add cell indicating whether it is a temporary permission.
      item.appendChild(this._createTemporaryPermissionsCell(items[i][3]));
    }
  },

  /**
   * Create a cell for the "temporary" indicator.
   * 
   * @param {Boolean}
   *            isTemporary
   * @return {listcell}
   */
  _createTemporaryPermissionsCell : function(isTemporary) {
    var cell = document.createElement("listcell");
    if (isTemporary) {
      cell.setAttribute("class", "listcell-iconic temporaryPermissionsCell");
    }
    return cell;
  },

  listChanged : function(listbox) {
    listbox.removeButton.setAttribute("disabled",
        listbox.selectedItems.length == 0);
  },

  removeSelectedFromList : function(listbox) {
    for (var i = 0; i < listbox.selectedItems.length; i++) {
      listbox.forbid(listbox.selectedItems[i].value);
    }
    while (listbox.selectedItems.length > 0) {
      listbox.removeItemAt(listbox.getIndexOfItem(listbox.selectedItems[0]));
    }
  }

}

// Initialize the requestpolicyPrefs object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicyPrefs.init();
    }, false);
