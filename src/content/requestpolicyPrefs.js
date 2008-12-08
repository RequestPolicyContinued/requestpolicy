Components.utils.import("resource://requestpolicy/Logger.jsm");

var requestpolicyPrefs = {

  _initialized : false,
  _requestpolicy : null,

  // For things we can't do through the nsIRequestPolicy interface, use direct
  // access to the underlying JS object.
  _requestpolicyJSObject : null,

  _strbundle : null,

  _originsList : null,
  _destinationsList : null,
  _originsToDestinationsList : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._requestpolicy = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._requestpolicyJSObject = this._requestpolicy.wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");

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
  },

  _getFilePickerWindowTitle : function(action) {
    // TODO
    // return this._strbundle.getString(action == "import" ? XXX : XXX);
    return "Select a file...";
  },

  _getPickedFile : function(action, type) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(nsIFilePicker);

    var windowTitle = this._getFilePickerWindowTitle(action);
    var mode = action == "import"
        ? nsIFilePicker.modeOpen
        : nsIFilePicker.modeSave;
    fp.init(window, windowTitle, mode);
    fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

    if (action == "import") {
      fp.defaultExtension = ".txt";
    } else {
      fp.defaultString = "requestpolicy-whitelist.txt";
    }

    var ret = fp.show();
    return (ret == nsIFilePicker.returnOK || ret == nsIFilePicker.returnReplace)
        ? fp.file
        : null;
  },

  doFileAction : function(action) {
    try {
      var file = this._getPickedFile(action);
      if (!file) {
        return;
      }
      this["_" + action](file);
    } catch (e) {
      window.alert(e.toString());
    }
  },

  _import : function(file, type) {
    Logger.dump("Importing: " + type);
    var items = this._fileToArray(file);
    Logger.vardump(items);
  },

  _export : function(file, type) {
    Logger.dump("Exporting: " + type);
  },

  _fileToArray : function(file) {
    var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Components.interfaces.nsIFileInputStream);
    stream.init(file, 0x01, 0444, 0);
    stream.QueryInterface(Components.interfaces.nsILineInputStream);
    var line = {}, lines = [], hasmore;
    do {
      hasmore = stream.readLine(line);
      lines.push(line.value);
    } while (hasmore);
    stream.close();
    return lines;
  },

  _arrayToFile : function(dataArray, file) {
    var stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);
    stream.init(file, 0x04 | 0x08 | 0x20, 0600, 0); // write, create, truncate
    for (var i = 0; i < dataArray.length; i++) {
      foStream.write(dataArray + "\n", dataArray[i].length + 1);
    }
    stream.close();
  }

}

// Initialize the requestpolicyPrefs object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicyPrefs.init();
    }, false);
