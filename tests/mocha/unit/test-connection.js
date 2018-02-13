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
  let gotMessage;

  beforeEach(() => {
    port = createPort(sinon);
    gotMessage = sinon.stub();
    connection = new Connection(
        moduleName,
        Log.instance,
        targetName,
        port,
        gotMessage
    );
  });

  afterEach(() => {
    browser.flush();
    sinon.restore();
  });

  function fullyStartupConnection() {
    connection.startup();
    port.onMessage.dispatch({
      id: "startup",
      isResponse: true,
      target: moduleName,
      value: "ready",
    });
  }

  it("first add message listener, then send message", function() {
    connection.startup();
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
  });

  it("responds to startup message from target", function() {
    connection.startup();
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
    return pCalled.then(() => {
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
    connection.startup();
    assert.strictEqual(connection.isReady(), false);
  });

  it("is ready after receiving startup response", function() {
    connection.startup();
    port.onMessage.dispatch({
      id: "startup",
      isResponse: true,
      target: moduleName,
      value: "ready",
    });
    return connection.whenReady.then(() => {
      assert.strictEqual(connection.isReady(), true);
      return;
    });
  });

  it("is ready after receiving startup message (non-response)", function() {
    connection.startup();
    port.onMessage.dispatch({
      id: "startup",
      isResponse: false,
      target: moduleName,
      value: "ready",
    });
    return connection.whenReady.then(() => {
      assert.strictEqual(connection.isReady(), true);
      return;
    });
  });

  it("resolves to response when sending a message", function() {
    fullyStartupConnection();
    return connection.whenReady.then(() => {
      const p = connection.sendMessage("foo_id", "bar_value");
      port.onMessage.dispatch({
        id: "foo_id",
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
    return connection.whenReady.then(() => {
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
      sinon.assert.calledWithMatch(gotMessage, "foo_id", "bar_value");
      return;
    });
  });

  it("sends back the response returned by 'gotMessage'", function() {
    fullyStartupConnection();
    return connection.whenReady.then(() => {
      const pGotMessageCalled = new Promise((resolve) => {
        gotMessage.callsFake(() => {
          resolve();
          return Promise.resolve("baz_response");
        });
      });
      port.postMessage.reset();
      port.onMessage.dispatch({
        id: "foo_id",
        isResponse: false,
        target: moduleName,
        value: "bar_value",
      });
      return pGotMessageCalled;
    }).then(() => {
      sinon.assert.calledWithMatch(port.postMessage, {
        id: "foo_id",
        isResponse: true,
        target: targetName,
        value: "baz_response",
      });
      return;
    });
  });

  it("sendMessage() rejects on two subsequent identical calls " +
      "w/o a response in between", function() {
    fullyStartupConnection();

    function sendMessage() {
      return connection.sendMessage("foo_id", "bar_value");
    }
    return connection.whenReady.then(() => {
      const pGotMessageCalled = new Promise((resolve) => {
        port.postMessage.callsFake(resolve);
      });
      sendMessage();
      return pGotMessageCalled;
    }).then(() => {
      const originalError = console.error;
      console.error = sinon.stub();
      // eslint-disable-next-line promise/no-nesting
      return sendMessage().then(() => {
        assert.fail(0, 1);
        return;
      }).catch(() => {
        console.error.reset();
        return Promise.resolve();
      }).then(() => {
        console.error = originalError;
        return;
      });
    });
  });
});
