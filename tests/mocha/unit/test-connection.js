"use strict";

const {assert} = require("chai");
const {createBrowserApi, createPort} = require("../lib/sinon-chrome");

const {Log} = require("lib/classes/log");
const {Connection} = require("lib/classes/connection");

describe("connection", function() {
  const sinon = require("sinon").sandbox.create();

  const browser = createBrowserApi();

  const moduleName = "my-module";
  const targetName = "my-target";
  let port;
  let connection;

  beforeEach(() => {
    port = createPort(sinon);
    const log = new Log();
    connection = new Connection(
        moduleName,
        log,
        targetName,
        () => Promise.resolve(port)
    );
  });

  afterEach(() => {
    browser.flush();
    sinon.restore();
  });

  function startupUntilStartupMessageSent() {
    const pStartupMessageSent = new Promise((resolve) => {
      port.postMessage.onFirstCall().callsFake(resolve);
    });
    connection.startup();
    return pStartupMessageSent;
  }

  function fullyStartupConnection() {
    return startupUntilStartupMessageSent().then(() => {
      port.onMessage.dispatch({
        id: "startup",
        isResponse: true,
        target: moduleName,
        value: "ready",
      });
      return;
    });
  }

  it("first add message listener, then send message", function() {
    return startupUntilStartupMessageSent().then(() => {
      sinon.assert.callOrder(
          port.onMessage.addListener,
          port.postMessage
      );
      sinon.assert.calledWithMatch(port.postMessage, {
        id: "startup",
        isResponse: false,
        target: targetName,
        value: "ready",
      });
      return;
    });
  });

  it("responds to startup message from target", function() {
    return startupUntilStartupMessageSent().then(() => {
      port.postMessage.reset();
      const pResponseSent = new Promise((resolve) => {
        port.postMessage.callsFake(resolve);
      });
      port.onMessage.dispatch({
        id: "startup",
        isResponse: false,
        target: moduleName,
        value: "ready",
      });
      return pResponseSent;
    }).then(() => {
      sinon.assert.calledOnce(port.postMessage);
      sinon.assert.calledWithMatch(port.postMessage, {
        id: "startup",
        isResponse: true,
        target: targetName,
        value: "ready",
      });
      return;
    });
  });

  it("is not ready before target startup", function() {
    return startupUntilStartupMessageSent().then(() => {
      assert.strictEqual(connection.isReady(), false);
      return;
    });
  });

  it("is ready after receiving startup response", function() {
    return startupUntilStartupMessageSent().then(() => {
      port.onMessage.dispatch({
        id: "startup",
        isResponse: true,
        target: moduleName,
        value: "ready",
      });
      return connection.whenReady;
    }).then(() => {
      assert.strictEqual(connection.isReady(), true);
      return;
    });
  });

  it("is ready after receiving startup message (non-response)", function() {
    return startupUntilStartupMessageSent().then(() => {
      port.onMessage.dispatch({
        id: "startup",
        isResponse: false,
        target: moduleName,
        value: "ready",
      });
      return connection.whenReady;
    }).then(() => {
      assert.strictEqual(connection.isReady(), true);
      return;
    });
  });

  it("resolves to response when sending a message", function() {
    return fullyStartupConnection().then(() => {
      port.postMessage.resetHistory();
      const p = connection.sendMessage("bar_value");
      const {id} = port.postMessage.getCall(0).args[0];
      port.onMessage.dispatch({
        id,
        isResponse: true,
        target: moduleName,
        value: "baz_response",
      });
      return p;
    }).then((response) => {
      assert.strictEqual(response, "baz_response");
      return;
    });
  });

  it("calls 'gotMessage' callback when receiving a non-response message", function() {
    const gotMessage = sinon.stub();
    return fullyStartupConnection().then(() => {
      connection.onMessage.addListener(gotMessage);
      const pGotMessageCalled = new Promise((resolve) => {
        gotMessage.callsFake(() => {
          resolve();
          return Promise.resolve("baz_response");
        });
      });
      port.onMessage.dispatch({
        id: "foo_id",
        isResponse: false,
        target: moduleName,
        value: "bar_value",
      });
      return pGotMessageCalled;
    }).then(() => {
      sinon.assert.calledOnce(gotMessage);
      sinon.assert.calledWithMatch(gotMessage, "bar_value");
      return;
    });
  });

  it("sends back the response returned by 'gotMessage'", function() {
    const gotMessage = sinon.stub();
    return fullyStartupConnection().then(() => {
      connection.onMessage.addListener(gotMessage);
      gotMessage.resolves("baz_response");

      // I don't know why, but `resetHistory()` did not work here. It caused
      // the fake function (below) not to be called. So instead I use
      // `calledOnce()` (and `calledTwice()` below).
      sinon.assert.calledOnce(port.postMessage);
      // port.postMessage.resetHistory();

      const pPostMessageCalled = new Promise((resolve) => {
        port.postMessage.callsFake(resolve);
        port.onMessage.dispatch({
          id: "foo_id",
          isResponse: false,
          target: moduleName,
          value: "bar_value",
        });
      });
      return pPostMessageCalled;
    }).then(() => {
      sinon.assert.calledTwice(port.postMessage);
      sinon.assert.calledWithMatch(port.postMessage, {
        id: "foo_id",
        isResponse: true,
        target: targetName,
        value: "baz_response",
      });
      return;
    });
  });
});
