/* eslint jest/max-expects: [warn, { max: 3 }] -- Ok */

import { AssertionError, as, assert, evaluate } from "@skylib/functions";
import type { stringU, unknowns } from "@skylib/functions";
import $ from "jquery";
import { implementations } from "@";

const { Facebook } = implementations.facebook;

const getScript = jest
  .spyOn($, "getScript")
  .mockImplementation((...args: unknowns) => {
    assert.toBeTrue(
      args.length === 1 &&
        args[0] === "https://connect.facebook.net/en_US/sdk.js",
      "Invalid args"
    );

    return {} as JQuery.jqXHR<stringU>;
  });

globalThis.FB = evaluate(() => {
  let appId: stringU;

  return {
    getAuthResponse: () => (appId === "loggedIn" ? getAuthResponse() : null),
    init: params => {
      appId = params.appId;
    },
    login: (callback: (response: fb.StatusResponse) => void) => {
      callback({ authResponse: getAuthResponse(), status: getStatus() });
    }
  } as typeof FB;

  function getAuthResponse(): fb.AuthResponse {
    return {
      accessToken: as.not.empty(appId),
      expiresIn: 3600,
      signedRequest: "signed-request",
      userID: "user-id"
    };
  }

  function getStatus(): fb.LoginStatus {
    switch (appId) {
      case "authorization_expired":
      case "connected":
      case "not_authorized":
      case "unknown":
        return appId;

      default:
        throw new Error("Unexpected app ID");
    }
  }
});

test("Facebook.accessToken", async () => {
  const facebook = new Facebook(undefined, "10.0");

  const error = new AssertionError("Missing Facebook app ID");

  await expect(facebook.accessToken()).rejects.toStrictEqual(error);
});

test("Facebook.accessToken: authorization_expired", async () => {
  const appId = "authorization_expired";

  const facebook = new Facebook(appId, "10.0");

  const error = new Error("Facebook login failed (authorization_expired)");

  await expect(facebook.accessToken()).rejects.toStrictEqual(error);
});

test("Facebook.accessToken: connected", async () => {
  const appId = "connected";

  const facebook = new Facebook(appId, "10.0");

  await expect(facebook.accessToken()).resolves.toBe(appId);
});

test("Facebook.accessToken: loggedIn", async () => {
  const appId = "loggedIn";

  const facebook = new Facebook(appId, "10.0");

  await expect(facebook.accessToken()).resolves.toBe(appId);
});

test("Facebook.accessToken: not_authorized", async () => {
  const appId = "not_authorized";

  const facebook = new Facebook(appId, "10.0");

  await expect(facebook.accessToken()).resolves.toBeUndefined();
});

test("Facebook.accessToken: unknown", async () => {
  const appId = "unknown";

  const error = new Error("Facebook login failed (unknown)");

  const facebook = new Facebook(appId, "10.0");

  await expect(facebook.accessToken()).rejects.toStrictEqual(error);
});

test("Facebook.loadSdk", async () => {
  const facebook = new Facebook(appId, "10.0");

  const expected = ["https://connect.facebook.net/en_US/sdk.js"] as const;

  expect(getScript).mockCallsToBe();
  await facebook.loadSdk();
  expect(getScript).mockCallsToBe(expected);
  await facebook.loadSdk();
  expect(getScript).mockCallsToBe();

  async function appId(): Promise<stringU> {
    await Promise.resolve();

    return "loggedIn";
  }
});
