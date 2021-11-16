/* eslint-disable no-alert */
import * as fn from "@skylib/functions/es/function";
export const implementation = fn.run(() => {
    function jsConfirm(message, success, failure) {
        if (confirm(message))
            success === null || success === void 0 ? void 0 : success();
        else
            failure === null || failure === void 0 ? void 0 : failure();
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    jsConfirm.async = async (message) => confirm(message);
    return jsConfirm;
});
//# sourceMappingURL=jsConfirm.js.map