import $ from "jquery";
import * as assert from "@skylib/functions/es/assertions";
import * as fn from "@skylib/functions/es/function";
import * as is from "@skylib/functions/es/guards";
export class Facebook {
    /**
     * Creates class instance.
     *
     * @param appId - Facebook app ID.
     * @param version - Version.
     */
    constructor(appId, version) {
        /*
        |*****************************************************************************
        |* Protected
        |*****************************************************************************
        |*/
        Object.defineProperty(this, "appId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sdk", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: undefined
        });
        Object.defineProperty(this, "version", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.appId = appId;
        this.version = version;
    }
    async accessToken() {
        await this.loadSdk();
        const auth = FB.getAuthResponse();
        if (auth)
            return auth.accessToken;
        const statusResponse = await new Promise(resolve => {
            FB.login(response => {
                resolve(response);
            });
        });
        switch (statusResponse.status) {
            case "connected":
                return statusResponse.authResponse.accessToken;
            case "not_authorized":
                return undefined;
            default:
                throw new Error(`Facebook login failed (${statusResponse.status})`);
        }
    }
    async loadSdk() {
        var _a;
        this.sdk =
            (_a = this.sdk) !== null && _a !== void 0 ? _a : fn.run(async () => {
                await $.getScript("https://connect.facebook.net/en_US/sdk.js");
                const appId = is.callable(this.appId)
                    ? await this.appId()
                    : await this.appId;
                assert.not.empty(appId, "Missing Facebook app ID");
                FB.init({
                    appId,
                    autoLogAppEvents: true,
                    version: this.version,
                    xfbml: true
                });
            });
        await this.sdk;
    }
}
//# sourceMappingURL=Facebook.js.map