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

/**
 * This singleton module can be used for having a reference to documents
 * (whether top level or frame documents). This is necessary when chrome code
 * needs to call functions on specific documents.
 */
let DocManager = (function() {
  let self = {};

  let nextDocID = 0;
  let documents = [];

  self.generateDocID = function(doc) {
    let docID = nextDocID++;
    documents[docID] = doc;

    // Destructor function:
    // As soon as the document is unloaded, delete the reference.
    // The unload event is called when the document's location changes.
    content.addEventListener("unload", function() {
      delete documents[docID];
    });

    return docID;
  };

  self.getDocument = function(docID) {
    return documents[docID] || null;
  };

  return self;
}());
