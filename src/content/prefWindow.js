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

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/FileUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Prompter.jsm",
    requestpolicy.mod);

requestpolicy.prefWindow = {

  _initialized : false,
  _rpService : null,

  // For things we can't do through the nsIRequestPolicy interface, use direct
  // access to the underlying JS object.
  _rpServiceJSObject : null,

  _strbundle : null,

  _originsList : null,
  _destinationsList : null,
  _originsToDestinationsList : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._rpServiceJSObject = this._rpService.wrappedJSObject;

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
        requestpolicy.prefWindow._rpService.forbidOriginDelayStore(origin);
      };
      this._destinationsList.forbid = function(destination) {
        requestpolicy.prefWindow._rpService
            .forbidDestinationDelayStore(destination);
      };
      this._originsToDestinationsList.forbid = function(originToDestIdentifier) {
        // Third param is "delay store".
        requestpolicy.prefWindow._rpServiceJSObject
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
        var origin = requestpolicy.prefWindow._addOriginButton.textboxes[0].value;
        // First forbid the item so that amy temporarily allowed item will be
        // removed.
        requestpolicy.prefWindow._rpServiceJSObject.forbidOrigin(origin);
        requestpolicy.prefWindow._rpServiceJSObject.allowOrigin(origin);
      };
      this._addDestinationButton.allow = function() {
        var dest = requestpolicy.prefWindow._addDestinationButton.textboxes[0].value;
        // First forbid the item so that amy temporarily allowed item will be
        // removed.
        requestpolicy.prefWindow._rpServiceJSObject.forbidDestination(dest);
        requestpolicy.prefWindow._rpServiceJSObject.allowDestination(dest);
      };
      this._addOriginToDestinationButton.allow = function() {
        var origin = requestpolicy.prefWindow._addOriginToDestinationButton.textboxes[0].value;
        var dest = requestpolicy.prefWindow._addOriginToDestinationButton.textboxes[1].value;
        // First forbid the item so that amy temporarily allowed item will be
        // removed.
        requestpolicy.prefWindow._rpServiceJSObject.forbidOriginToDestination(
            origin, dest);
        requestpolicy.prefWindow._rpServiceJSObject.allowOriginToDestination(
            origin, dest);
      };

      this._populateWhitelists();
    }
  },

  /**
   * Updates the status bar icons in each window.
   */
  statusbarIconChanged : function(iconStyle) {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
    var enumerator = wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      var window = enumerator.getNext();
      if ("requestpolicy" in window && "overlay" in window.requestpolicy) {
        window.requestpolicy.overlay.setStatusbarIconStyle(iconStyle);
      }
    }
  },

  /**
   * Updates the context menu visibility in each window.
   */
  contextMenuChanged : function(isEnabled) {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
    var enumerator = wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      var window = enumerator.getNext();
      if ("requestpolicy" in window && "overlay" in window.requestpolicy) {
        window.requestpolicy.overlay.setContextMenuEnabled(isEnabled);
      }
    }
  },

  /**
   * Clears the data we have about allowed and blocked requests for the current
   * session because it will no longer be relevant with the uri identification
   * level having been changed. Not clearing this out results in odd and
   * confusing content in the menu. Attempting to make the information valid for
   * the new identification level will only lead to more confusion, as what
   * would be shown in the menu really wouldn't be correct still.
   */
  uriIdentificationLevelChanged : function(level) {
    this._rpServiceJSObject._rejectedRequests = {};
    this._rpServiceJSObject._allowedRequests = {};
  },

  _clearListbox : function(listbox) {
    for (var i = listbox.itemCount - 1; i >= 0; i--) {
      listbox.removeItemAt(i);
    }
  },

  _populateWhitelists : function() {
    // Origins.
    var origins = [];
    for (var i in this._rpServiceJSObject._allowedOrigins) {
      origins.push([i, false]);
    }
    for (var i in this._rpServiceJSObject._temporarilyAllowedOrigins) {
      origins.push([i, true]);
    }
    origins.sort(function(a, b) {
          return a[0].localeCompare(b[0]);
        });
    this._populateListboxFromObjectProperties(this._originsList, origins);

    // Destinations.
    var destinations = [];
    for (var i in this._rpServiceJSObject._allowedDestinations) {
      destinations.push([i, false]);
    }
    for (var i in this._rpServiceJSObject._temporarilyAllowedDestinations) {
      destinations.push([i, true]);
    }
    destinations.sort(function(a, b) {
          return a[0].localeCompare(b[0]);
        });
    this._populateListboxFromObjectProperties(this._destinationsList,
        destinations);

    // Origins to destinations.
    var originsToDestinations = [];
    for (var i in this._rpServiceJSObject._allowedOriginsToDestinations) {
      var parts = i.split("|");
      originsToDestinations.push([parts[0], parts[1], i, false]);
    }
    for (var i in this._rpServiceJSObject._temporarilyAllowedOriginsToDestinations) {
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
   *          isTemporary
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
    this._rpService.storeAllPreferenceLists();
    for (var i = listbox.childNodes.length - 1; i >= 0; i--) {
      if (listbox.childNodes[i].selected) {
        listbox.removeChild(listbox.childNodes[i]);
      }
    }
    requestpolicy.prefWindow.listSelectionChanged(listbox)
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
    // TODO: Warn people when they enter UTF8 formatted IDNs for TLDs that
    //       Mozilla doesn't support UTF8 IDNs for, and warn when they enter
    //       ACE formatted IDNs for TLDs that are supported in UTF8. An entry
    //       in the wrong format will get ignored. This seems to be somewhat
    //       of an argument for always storing/comparing in ACE format. Even
    //       though this seems like it may be a pain to go back and rectify
    //       later if we decide we only want to store ACE format, I just don't
    //       see the complexity of dealing with it now to be worth it,
    //       especially as only time will tell if it really is a nuisance.
    
    button.disabled = true;
    // Remove pipes and spaces which would conflict with the separators we use
    // when storing these in preferences.
    for (var i = 0; i < button.textboxes.length; i++) {
      button.textboxes[i].value = button.textboxes[i].value.replace(/[\|\s]/g,
          "");
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
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error during import/export file operation: " + e
              + ", stack was: " + e.stack);
      window.alert(e.toString());
    }
  },

  _import : function(file) {
    requestpolicy.mod.Logger.dump("Starting import from " + file.path);
    var groupToFunctionMap = {
      "origins" : "allowOrigin",
      "destinations" : "allowDestination",
      "origins-to-destinations" : "_allowOriginToDestinationByCombinedIdentifier"
    };
    var lines = requestpolicy.mod.FileUtil.fileToArray(file);
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
        requestpolicy.mod.Logger.dump("Importing " + currentLine + " into "
            + currentGroup);
        this._rpServiceJSObject[importFunction](currentLine, true);
      }
    }

    // We delayed storage of the preference lists, so store the data now.
    this._rpService.storeAllPreferenceLists();

    this._populateWhitelists();
    requestpolicy.mod.Prompter.alert(this._getFilePickerWindowTitle('import'),
        this._strbundle.getString("importCompleted"));
  },

  _export : function(file) {
    requestpolicy.mod.Logger.dump("Starting export to " + file.path);
    var lines = [];
    lines.push("[origins]");
    for (var i in this._rpServiceJSObject._allowedOrigins) {
      lines.push(i);
    }
    lines.push("[destinations]");
    for (var i in this._rpServiceJSObject._allowedDestinations) {
      lines.push(i);
    }
    lines.push("[origins-to-destinations]");
    for (var i in this._rpServiceJSObject._allowedOriginsToDestinations) {
      lines.push(i);
    }
    requestpolicy.mod.FileUtil.arrayToFile(lines, file);
    requestpolicy.mod.Prompter.alert(this._getFilePickerWindowTitle('export'),
        this._strbundle.getString("exportCompleted"));
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

// Initialize the requestpolicy.prefWindow object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicy.prefWindow.init();
    }, false);
