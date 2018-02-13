"use strict";

const {assert} = require("chai");
const {createBrowserApi, createPort} = require("../lib/sinon-chrome");

const {Log} = require("models/log");
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
    connection = new Connection(
        moduleName,
        Log.instance,
        targetName,
        Promise.resolve(port)
    );
  });

  afterEach(() => {
    browser.flush();
    sinon.restore();
  });

  function fullyStartupConnection() {
    connection.startup().then(() => {
      port.onMessage.dispatch({
        id: "startup",
        isResponse: true,
        target: moduleName,
        value: "ready",
      });
      return;
    }).catch((e) => {
      console.error(e);
    });
  }

  it("first add message listener, then send message", function() {
    return connection.startup().then(() => {
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
    return connection.startup().then(() => {
      port.postMessage.reset();
      const pCalled = new Promise((resolve) => {
        port.postMessage.callsFake(resolve);
      });
      port.onMessage.dispatch({
        id: "startup",
        isResponse: false,
        target: moduleName,
        value: "ready",
      });
      return pCalled;
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
    return connection.startup().then(() => {
      assert.strictEqual(connection.isReady(), false);
      return;
    });
  });

  it("is ready after receiving startup response", function() {
    return connection.startup().then(() => {
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
    return connection.startup().then(() => {
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
    fullyStartupConnection();
    return connection.whenReady.then(() => {
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
    fullyStartupConnection();
    const gotMessage = sinon.stub();
    return connection.whenReady.then(() => {
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
    fullyStartupConnection();
    const gotMessage = sinon.stub();
    return connection.whenReady.then(() => {
      connection.onMessage.addListener(gotMessage);
      gotMessage.resolves("baz_response");
      port.postMessage.resetHistory();
      const pPostMessageCalled = new Promise((resolve) => {
        port.postMessage.callsFake(resolve);
      });
      port.onMessage.dispatch({
        id: "foo_id",
        isResponse: false,
        target: moduleName,
        value: "bar_value",
      });
      return pPostMessageCalled;
    }).then(() => {
      sinon.assert.calledOnce(port.postMessage);
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
