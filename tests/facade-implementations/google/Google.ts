/**
 * @jest-environment @skylib/config/src/jest-env-jsdom
 */
import $ from "jquery";

import { google } from "@skylib/facades/dist/google";
import * as assert from "@skylib/functions/dist/assertions";
import { AssertionError } from "@skylib/functions/dist/errors/AssertionError";
import type { stringU } from "@skylib/functions/dist/types/core";

import { Google } from "@/facade-implementations/google/Google";

interface Reason {
  details: string;
  error: string;
}

const getScript = jest
  .spyOn($, "getScript")
  .mockImplementation((...args: unknown[]) => {
    assert.toBeTrue(args.length === 1);
    assert.toBeTrue(args[0] === "https://apis.google.com/js/api:client.js");

    let clientId: stringU = undefined;

    globalThis.gapi = {
      auth2: {
        init(params) {
          clientId = params.client_id;

          const user = {
            getAuthResponse() {
              assert.not.empty(clientId);

              return { id_token: `access-token-${clientId}` };
            }
          } as gapi.auth2.GoogleUser;

          return {
            then(
              onInit: (googleAuth: gapi.auth2.GoogleAuth) => void,
              onFailure: (reason: Reason) => void
            ) {
              if (clientId === "init_error")
                onFailure({
                  details: "Init error",
                  error: "init_error"
                });
              else
                onInit({
                  currentUser: {
                    get() {
                      return user;
                    }
                  },
                  isSignedIn: {
                    get() {
                      return params.client_id === "signedIn";
                    }
                  },
                  async signIn() {
                    await Promise.resolve();

                    if (clientId === "popup_closed_by_user")
                      // eslint-disable-next-line @typescript-eslint/no-throw-literal
                      throw {
                        details: "Popup closed by user",
                        error: "popup_closed_by_user"
                      };

                    if (clientId === "unknown_error")
                      throw new Error("Unknown error");

                    return user;
                  }
                } as gapi.auth2.GoogleAuth);
            }
          } as gapi.auth2.GoogleAuth;
        }
      },
      load(apiName, callback) {
        assert.toBeTrue(apiName === "auth2");
        assert.callable(callback);
        callback();
      }
    } as typeof gapi;

    return {} as JQuery.jqXHR<stringU>;
  });

it("Google.idToken", async () => {
  const error = new AssertionError("Missing Google client ID");

  await expect(google.idToken()).rejects.toStrictEqual(error);
});

it("Google.idToken: init_error", async () => {
  const clientId = "init_error";

  const error = new Error("Error init_error: Init error");

  google.setImplementation(new Google(clientId));
  await expect(google.idToken()).rejects.toStrictEqual(error);
});

it("Google.idToken: popup_closed_by_user", async () => {
  const clientId = "popup_closed_by_user";

  google.setImplementation(new Google(clientId));
  await expect(google.idToken()).resolves.toBeUndefined();
});

it("Google.idToken: signIn", async () => {
  const clientId = "signIn";

  const accessToken = `access-token-${clientId}`;

  google.setImplementation(new Google(clientId));
  await expect(google.idToken()).resolves.toStrictEqual(accessToken);
});

it("Google.idToken: signedIn", async () => {
  const clientId = "signedIn";

  const accessToken = `access-token-${clientId}`;

  google.setImplementation(new Google(clientId));
  await expect(google.idToken()).resolves.toStrictEqual(accessToken);
});

it("Google.idToken: unknown_error", async () => {
  const clientId = "unknown_error";

  const error = new Error("Unknown error");

  google.setImplementation(new Google(clientId));
  await expect(google.idToken()).rejects.toStrictEqual(error);
});

it("Google.loadSdk", async () => {
  google.setImplementation(new Google(clientId));

  {
    expect(getScript).not.toBeCalled();
    await google.loadSdk();
    expect(getScript).toBeCalledTimes(1);
  }

  {
    await google.loadSdk();
    expect(getScript).toBeCalledTimes(1);
  }

  async function clientId(): Promise<stringU> {
    await Promise.resolve();

    return "signedIn";
  }
});