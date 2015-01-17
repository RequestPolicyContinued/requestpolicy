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
 *
 */
let DocManager = (function() {
  let self = {};

  let nextDocID = 0;
  let documents = new Map();

  // the DocManager is enabled until it is shut down.
  let enabled = true;


  function cleanUpDoc(docID) {
    let {doc, unloadCallback} = documents.get(docID);
    // clean up listeners

    doc.removeEventListener("unload", unloadCallback);
    // no longer remember the document
    documents.delete(docID);
  }

  // TODO: Create a `getDocEnv` function. The Environment can then also be
  //       used to call `cleanUpDoc`.
  //self.getDocEnv = function(doc) {};


  self.generateDocID = function(doc) {
    if (!enabled) {
      return null;
    }

    let docID = nextDocID++;

    let cleanUpThisDoc = cleanUpDoc.bind(this, docID);

    // Destructor function:
    // As soon as the document is unloaded, delete the reference.
    // The unload event is called when the document's location changes.
    doc.addEventListener("unload", cleanUpThisDoc);

    documents.set(docID, {
      doc: doc,
      unloadCallback: cleanUpThisDoc
    });

    return docID;
  };

  function cleanUpAllDocs() {
    // call `cleanUpAllDoc` for all docs
    for (let [docID] of documents) {
      // Note to the loop's head:
      //     Destructuring assignment (ECMAScript 6) is used, that is, only
      //     the "key" of `documents` is used, the "value" is ignored.
      cleanUpDoc(docID);
    }
  }

  function shutdownDocManager() {
    enabled = false;
    cleanUpAllDocs();
  }
  FrameScriptEnv.addShutdownFunction(Environment.LEVELS.BACKEND,
                                     shutdownDocManager);

  self.getDocument = function(docID) {
    if (documents.has(docID)) {
      return documents.get(docID).doc;
    }
    return null;
  };

  return self;
}());
