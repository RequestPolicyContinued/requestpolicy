/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * 
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 * 
 * ***** END LICENSE BLOCK *****
 */

Components.utils.import("resource://requestpolicy/FileUtils.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/Prompter.jsm");

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

      this._addOriginButton = document.getElementById("addOrigin");
      this._addDestinationButton = document.getElementById("addDestination");
      this._addOriginToDestinationButton = document
          .getElementById("addOriginToDestination");

      // Each list has a "removeButton" property which is the list's associated
      // "remove selected items" button.
      this._originsList.removeButton = document.getElementById("removeOrigins");
      this._destinationsList.removeButton = document
          .getElementById("removeDestinations");
      this._originsToDestinationsList.removeButton = document
          .getElementById("removeOriginsToDestinations");

      this._addOrigin_originField = document
          .getElementById("addOrigin-originField");
      this._addDestination_destinationField = document
          .getElementById("addDestination-destinationField");
      this._addOriginToDestination_originField = document
          .getElementById("addOriginToDestination-originField");
      this._addOriginToDestination_destinationField = document
          .getElementById("addOriginToDestination-destinationField");

      // Each "remove selected items" button has a "listbox" property which is
      // the button's associated list.
      this._originsList.removeButton.listbox = this._originsList;
      this._destinationsList.removeButton.listbox = this._destinationsList;
      this._originsToDestinationsList.removeButton.listbox = this._originsToDestinationsList;

      this._originsList.forbid = function(origin) {
        requestpolicyPrefs._requestpolicy.forbidOriginDelayStore(origin);
      };
      this._destinationsList.forbid = function(destination) {
        requestpolicyPrefs._requestpolicy
            .forbidDestinationDelayStore(destination);
      };
      this._originsToDestinationsList.forbid = function(originToDestIdentifier) {
        // Third param is "delay store".
        requestpolicyPrefs._requestpolicyJSObject
            ._forbidOriginToDestinationByCombinedIdentifier(
                originToDestIdentifier, true);
      };

      // Each "allow" button has an array of its associated textboxes.
      this._addOriginButton.textboxes = [this._addOrigin_originField];
      this._addDestinationButton.textboxes = [this._addDestination_destinationField];
      this._addOriginToDestinationButton.textboxes = [
          this._addOriginToDestination_originField,
          this._addOriginToDestination_destinationField];

      // Each "allow" textbox knows its associated button.
      this._addOrigin_originField.button = this._addOriginButton;
      this._addDestination_destinationField.button = this._addDestinationButton;
      this._addOriginToDestination_originField.button = this._addOriginToDestinationButton;
      this._addOriginToDestination_destinationField.button = this._addOriginToDestinationButton;

      // Each button has an "allow" function to whitelist the user-entered item.
      this._addOriginButton.allow = function() {
        requestpolicyPrefs._requestpolicyJSObject
            .allowOrigin(requestpolicyPrefs._addOriginButton.textboxes[0].value);
      };
      this._addDestinationButton.allow = function() {
        requestpolicyPrefs._requestpolicyJSObject
            .allowDestination(requestpolicyPrefs._addDestinationButton.textboxes[0].value);
      };
      this._addOriginToDestinationButton.allow = function() {
        requestpolicyPrefs._requestpolicyJSObject
            .allowOriginToDestination(
                requestpolicyPrefs._addOriginToDestinationButton.textboxes[0].value,
                requestpolicyPrefs._addOriginToDestinationButton.textboxes[1].value);
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

  _clearListbox : function(listbox) {
    for (var i = listbox.itemCount - 1; i >= 0; i--) {
      listbox.removeItemAt(i);
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
      originsToDestinations.push([parts[0], parts[1], i, false]);
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
    this._clearListbox(listbox);
    // The arrays are formatted as: [identifier, temporary]
    for (var i = 0; i < items.length; i++) {
      // This label goes in an implicit first cell.
      var item = document.createElement("listitem");
      item.setAttribute("value", items[i][0]);
      // Create a cell for the origin or destination.
      var cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][0]);
      item.appendChild(cell);
      // Add cell indicating whether it is a temporary permission.
      item.appendChild(this._createTemporaryPermissionsCell(items[i][1]));
      listbox.appendChild(item);
    }
  },

  _populateListboxFromTwoPartObjectProperties : function(listbox, items) {
    this._clearListbox(listbox);
    // The arrays are formatted as: [origin, dest, identifier, temporary]
    for (var i = 0; i < items.length; i++) {
      // This label (the origin) goes in an implicit first cell.
      var item = document.createElement("listitem");
      item.setAttribute("value", items[i][2]);
      // Create a cell for the origin.
      var cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][0]);
      item.appendChild(cell);
      // Create a cell for the destination.
      cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][1]);
      item.appendChild(cell);
      // Add cell indicating whether it is a temporary permission.
      item.appendChild(this._createTemporaryPermissionsCell(items[i][3]));
      listbox.appendChild(item);
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

  listSelectionChanged : function(listbox) {
    listbox.removeButton.setAttribute("disabled",
        listbox.selectedItems.length == 0);
  },

  removeSelectedFromList : function(listbox) {
    for (var i = 0; i < listbox.selectedItems.length; i++) {
      listbox.forbid(listbox.selectedItems[i].value);
    }
    // We delayed storage of the preference lists, so store the data now.
    this._requestpolicy.storeAllPreferenceLists();
    for (var i = listbox.childNodes.length - 1; i >= 0; i--) {
      if (listbox.childNodes[i].selected) {
        listbox.removeChild(listbox.childNodes[i]);
      }
    }
    requestpolicyPrefs.listSelectionChanged(listbox)
  },

  addToWhitelistInputChanged : function(textbox) {
    for (var i = 0; i < textbox.button.textboxes.length; i++) {
      if (textbox.button.textboxes[i].value.length == 0) {
        textbox.button.disabled = true;
        return;
      }
    }
    textbox.button.disabled = false;
  },

  addToWhitelist : function(button) {
    button.disabled = true;
    // Remove any "|" and spaces to avoid conflict with separators.
    for (var i = 0; i < button.textboxes.length; i++) {
      button.textboxes[i].value = button.textboxes[i].value.replace(
          /[^a-zA-Z0-9.-]/g, "");
      if (button.textboxes[i].value == "") {
        return;
      }
    }
    button.allow();
    for (var i = 0; i < button.textboxes.length; i++) {
      button.textboxes[i].value = "";
    }
    this._populateWhitelists();
  },

  _getFilePickerWindowTitle : function(action) {
    // Give the window title the same text as the clicked button's label.
    return document.getElementById(action + "Button").label;
  },

  _getPickedFile : function(action) {
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
      fp.defaultString = "requestpolicy-settings.txt";
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
      Logger.severe(Logger.TYPE_ERROR,
          "Fatal Error during import/export file operation: " + e
              + ", stack was: " + e.stack);
      window.alert(e.toString());
    }
  },

  _import : function(file) {
    Logger.dump("Starting import from " + file.path);
    var groupToFunctionMap = {
      "origins" : "allowOrigin",
      "destinations" : "allowDestination",
      "origins-to-destinations" : "_allowOriginToDestinationByCombinedIdentifier"
    };
    var lines = FileUtils.fileToArray(file);
    var currentGroup = null;
    var importFunction = null;
    for (var i = 0; i < lines.length; i++) {
      var currentLine = lines[i];
      // Skip empty lines.
      if (currentLine.length == 0) {
        continue;
      }
      // Change the import function if this is a group label.
      var label = currentLine.match(/^\[(.*)\]$/);
      if (label) {
        currentGroup = label[1];
        if (currentGroup in groupToFunctionMap) {
          importFunction = groupToFunctionMap[currentGroup];
        } else {
          throw "RequestPolicy: invalid group name in import: [" + label[0]
              + "]";
        }
      } else {
        // It's not a group label, it's something to import.
        if (!importFunction) {
          throw "RequestPolicy: there is no group label before the first item to import.";
        }
        Logger.dump("Importing " + currentLine + " into " + currentGroup);
        this._requestpolicyJSObject[importFunction](currentLine, true);
      }
    }

    // We delayed storage of the preference lists, so store the data now.
    this._requestpolicy.storeAllPreferenceLists();

    this._populateWhitelists();
    Prompter.alert(this._getFilePickerWindowTitle('import'), this._strbundle
            .getString("importCompleted"));
  },

  _export : function(file) {
    Logger.dump("Starting export to " + file.path);
    var lines = [];
    lines.push("[origins]");
    for (var i in this._requestpolicyJSObject._allowedOrigins) {
      lines.push(i);
    }
    lines.push("[destinations]");
    for (var i in this._requestpolicyJSObject._allowedDestinations) {
      lines.push(i);
    }
    lines.push("[origins-to-destinations]");
    for (var i in this._requestpolicyJSObject._allowedOriginsToDestinations) {
      lines.push(i);
    }
    FileUtils.arrayToFile(lines, file);
    Prompter.alert(this._getFilePickerWindowTitle('export'), this._strbundle
            .getString("exportCompleted"));
  },

  selectAll : function(event) {
    if ("selectAll" in event.explicitOriginalTarget) {
      // Unfortunately, selectAll() will sometimes leave some items unselected.
      // Trying to do it ourselves, though, seemed buggy in other ways (e.g. the
      // listbox's selectedItems wouldn't be updated, and doing it ourselves led
      // to other issues).
      event.explicitOriginalTarget.selectAll();
    }
  },

  /**
   * Opens the initial setup dialog as a modal window so that it can repopulate
   * the listboxes after the dialog is closed.
   */
  openModalInitialSetupDialog : function() {
    window.openDialog("chrome://requestpolicy/content/initialSetup.xul",
        "requestpolicyInitialSetupDialogWindow",
        "chrome, close, centerscreen, alwaysRaised, modal");
    this._populateWhitelists();
  }

}

// Initialize the requestpolicyPrefs object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicyPrefs.init();
    }, false);
