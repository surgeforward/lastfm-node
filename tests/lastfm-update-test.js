require('./common.js');
var LastFmSession = require('lastfm/lastfm-session');
var LastFmUpdate = require('lastfm/lastfm-update');
var fakes = require("./fakes");

(function() {
  describe("new LastFmUpdate")
    it("can have success and error handlers specified at creation (deprecated)", function() {
      var gently = new Gently();
      var lastfm = new LastFmNode();
      var update = new LastFmUpdate(lastfm, "method", new LastFmSession(lastfm, "user", "key"), {
        error: gently.expect(function error() {}),
        success: gently.expect(function success() {})
      });
      update.emit("error");
      update.emit("success");
    });

    it("can have success and error handlers specified in option at creation", function() {
      var gently = new Gently();
      var lastfm = new LastFmNode();
      var update = new LastFmUpdate(lastfm, "method", new LastFmSession(lastfm, "user", "key"), { handlers: {
          error: gently.expect(function error() {}),
          success: gently.expect(function success() {})
      }});
      update.emit("error");
      update.emit("success");
    });
})();

(function() {
  var request, returndata, options, session, method, gently, lastfm, authorisedSession, errorCode, errorMessage, update;

  function setupFixture() {
    request = new fakes.LastFmRequest();
    returndata;
    options = {};
    session = null;
    method = "";
    gently = new Gently();
    lastfm = new LastFmNode();
    authorisedSession = new LastFmSession(lastfm, "user", "key");
    errorCode = -1;
    errorMessage = null;
    update = undefined;
  }

  function whenWriteRequestReturns(data) {
    errorCode = -1;
    errorMessage = null;
    returndata = JSON.parse(data);
    request = new fakes.LastFmRequest();
    gently.expect(lastfm, "request", function() {
      return request;
    });
  }

  function whenWriteRequestThrowsError(code, message) {
    errorCode = code;
    errorMessage = message;
    request = new fakes.LastFmRequest();
    gently.expect(lastfm, "request", function() {
      return request;
    });
  }

  function andOptionsAre(setOptions) {
    options = setOptions;
  }

  function andMethodIs(setMethod) {
    method = setMethod;
  }

  function andSessionIs(setSession) {
    session = setSession;
  }

  function expectSuccess(assertions) {
    var checkSuccess = function(track) {
      if (assertions) {
        assertions(track);
      }
    };
    if (update) {
      update.on("success", checkSuccess);
    }
    else {
      options.handlers = options.handlers || {};
      options.handlers.success = checkSuccess;
    }
    doUpdate();
  }

  function expectError(expectedError) {
    var checkError = function(error) {
      if (expectedError) {
        assert.equal(expectedError, error.message);
      }
    };
    if (update) {
      update.on("error", checkError);
    }
    else {
      options.handlers = options.handlers || {};
      options.handlers.error = gently.expect(checkError);
    }
    doUpdate();
  }

  function doNotExpectError() {
    options.handlers = options.handlers || {};
    options.handlers.error = function checkNoErrorThrown(error) {
      assert.ok(false);
    };
    doUpdate();
  }

  function expectRetry() {
    if (update) {
      gently.expect(update, "emit", function(event) {
        assert.equal(event, "retrying");
      });
    }
    else {
      options.handlers = options.handlers || { };
      options.handlers.retrying = gently.expect(function retrying() { });
    }
    doUpdate();
  }

  function doUpdate() {
    update = update || new LastFmUpdate(lastfm, method, session, options);
    if (errorMessage) {
      request.emit("error", { error: errorCode, message: errorMessage });
    }
    else {
      request.emit("success", returndata);
    }
  }

  describe("update requests")
    before(function() {
      setupFixture();
    });
  
    it("fail when the session is not authorised", function() {
      var session = new LastFmSession();
      assert.throws(function() {
        new LastFmUpdate(lastfm, "method", session);
      });
    });
  
  describe("nowPlaying updates")
    before(function() {
      setupFixture();
    });
  
    it("uses updateNowPlaying method", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal("track.updateNowPlaying", method);
        return request;
      });
      new LastFmUpdate(lastfm, "nowplaying", authorisedSession, {
        track: FakeTracks.RunToYourGrave
      });
    });
    
    it("sends required parameters", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal(FakeTracks.RunToYourGrave, params.track);
        assert.equal("key", params.sk);
        return request;
      });
      new LastFmUpdate(lastfm, "nowplaying", authorisedSession, {
        track: FakeTracks.RunToYourGrave
      });
    });
  
    it("emits success when updated", function() {
      whenWriteRequestReturns(FakeData.UpdateNowPlayingSuccess);
      andMethodIs("nowplaying");
      andSessionIs(authorisedSession);
      andOptionsAre({
        track: FakeTracks.RunToYourGrave
      });
      expectSuccess(function(track) {
        assert.equal("Run To Your Grave", track.name);
      });
    });
  
    it("sends duration when supplied", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal(232000, params.duration);
        return request;
      });
      new LastFmUpdate(lastfm, "nowplaying", authorisedSession, {
        track: FakeTracks.RunToYourGrave,
        duration: 232000
      });
    });

    it("can have artist and track string parameters supplied", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal("The Mae Shi", params.artist);
        assert.equal("Run To Your Grave", params.track);
        assert.equal("key", params.sk);
        return request;
      });
      new LastFmUpdate(lastfm, "nowplaying", authorisedSession, {
        track: "Run To Your Grave",
        artist: "The Mae Shi"
      });
    });
  
    it("bubbles up errors", function() {
      var errorMessage = "Bubbled error";
      whenWriteRequestThrowsError(100, errorMessage);
      andMethodIs("nowplaying");
      andSessionIs(authorisedSession);
      andOptionsAre({
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
      expectError(errorMessage);
    });
  
  describe("a scrobble request")
    before(function() {
      setupFixture();
    });
  
    it("emits error when no timestamp supplied", function() {
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: FakeTracks.RunToYourGrave,
        handlers: {
          error: gently.expect(function error(error) {
            assert.equal("Timestamp is required for scrobbling", error.message);
          })
        }
      });
    });
    
    it("uses scrobble method", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal("track.scrobble", method);
        return request;
      });
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
    });
  
    it("sends required parameters", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal(FakeTracks.RunToYourGrave, params.track);
        assert.equal("key", params.sk);
        assert.equal(12345678, params.timestamp);
        return request;
      });
  
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
    });
  
    it("emits success when updated", function() {
      whenWriteRequestReturns(FakeData.ScrobbleSuccess);
      andMethodIs("scrobble");
      andSessionIs(authorisedSession);
      andOptionsAre({
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
      expectSuccess(function(track) {
        assert.equal("Run To Your Grave", track.name);
      });
    });
  
    it("bubbles up errors", function() {
      var errorMessage = "Bubbled error";
      whenWriteRequestThrowsError(100, errorMessage);
      andMethodIs("scrobble");
      andSessionIs(authorisedSession);
      andOptionsAre({
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
      expectError(errorMessage);
    });

    it("can have artist and track string parameters supplied", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal("The Mae Shi", params.artist);
        assert.equal("Run To Your Grave", params.track);
        assert.equal("key", params.sk);
        return request;
      });
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: "Run To Your Grave",
        artist: "The Mae Shi",
        timestamp: 12345678
      });
    });

    it("can have arbitrary parameters supplied", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal("somevalue", params.arbitrary);
        return request;
      });
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: "Run To Your Grave",
        artist: "The Mae Shi",
        timestamp: 12345678,
        arbitrary: "somevalue"
      });
    });

    it("does not include handler parameters", function() {
      gently.expect(lastfm, "request", function(method, params) {
        assert.equal(undefined, params.handlers);
        assert.equal(undefined, params.error);
        assert.equal(undefined, params.success);
        return request;
      });
      new LastFmUpdate(lastfm, "scrobble", authorisedSession, {
        track: "Run To Your Grave",
        artist: "The Mae Shi",
        timestamp: 12345678,
        handlers: { success: function() { } },
        success: function() { },
        error: function() { }
      });
    });

  var tmpFn;
  describe("update retries")
    before(function() {
      tmpFn = LastFmUpdate.prototype.scheduleCallback;
      LastFmUpdate.prototype.scheduleCallback = function(callback, delay) { };
      setupFixture();
      andMethodIs("scrobble");
      andSessionIs(authorisedSession);
      andOptionsAre({
        track: FakeTracks.RunToYourGrave,
        timestamp: 12345678
      });
    });
  
    after(function() {
      LastFmUpdate.prototype.scheduleCallback = tmpFn;
    });

    it("a error which should trigger a retry does not bubble errors", function() {
      whenWriteRequestThrowsError(11, "Service Offline");
      doNotExpectError();
    });
  
    it("service offline triggers a retry", function() {
      whenWriteRequestThrowsError(11, "Service Offline");
      expectRetry();
    });
  
    it("rate limit exceeded triggers a retry", function() {
      whenWriteRequestThrowsError(29, "Rate limit exceeded");
      expectRetry();
    });
  
    it("temporarily unavailable triggers a retry", function() {
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      expectRetry();
    });

    it("nowplaying update never trigger retries", function() {
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      andMethodIs("nowplaying");
      expectError();
    });

    it("first retry schedules a request after a 10 second delay", function() {
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      LastFmUpdate.prototype.scheduleCallback = gently.expect(function testSchedule(callback, delay) {
          assert.equal(delay, 10000);
      });
      doUpdate();
    });

    it("retry triggers another request", function() {
      var retried = false;
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      LastFmUpdate.prototype.scheduleCallback = function testSchedule(callback) {
        if (retried) {
          return;
        }
        retried = true;
        whenWriteRequestThrowsError(16, "Temporarily unavailable");
        callback();
        expectRetry();
      };
      doUpdate();
    });

    it("emits succes if retry is successful", function() {
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      LastFmUpdate.prototype.scheduleCallback = function testSchedule(callback) {
        whenWriteRequestReturns(FakeData.ScrobbleSuccess);
        callback();
        expectSuccess(function(track) {
          assert.equal("Run To Your Grave", track.name);
        });
      };
      doUpdate();
    });

    it("emits succes if retry is non-retry error", function() {
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      LastFmUpdate.prototype.scheduleCallback = function testSchedule(callback) {
        whenWriteRequestThrowsError(6, "Invalid parameter");
        callback();
        expectError("Invalid parameter");
      };
      doUpdate();
    });

    it("follows a retry schedule on subsequent failures", function() {
      var retrySchedule = [
            10 * 1000,
            30 * 1000,
            60 * 1000,
            5 * 60 * 1000,
            15 * 60 * 1000,
            30 * 60 * 1000,
            30 * 60 * 1000,
            30 * 60 * 1000
          ]
        , count = 0;
      whenWriteRequestThrowsError(16, "Temporarily unavailable");
      LastFmUpdate.prototype.scheduleCallback = function testSchedule(callback, delay) {
        if (count >= retrySchedule.length) {
          return;
        }
        assert.equal(delay, retrySchedule[count++]);
        whenWriteRequestThrowsError(16, "Temporarily unavailable");
        callback();
        expectRetry();
      };
      expectRetry();
      assert.equal(count, 8);
    });
})();
