"use strict";
/* eslint-disable @skylib/custom/functions/no-reflect-get -- Ok */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reflectStorage = void 0;
/* eslint-disable @skylib/custom/functions/no-reflect-set -- Ok */
const functions_1 = require("@skylib/functions");
exports.reflectStorage = (0, functions_1.defineFn)((obj) => {
    if (functions_1.reflect.hasMetadata(MetadataKey, obj))
        return obj;
    const result = new Proxy(obj, (0, functions_1.wrapProxyHandler)("reflectStorage", functions_1.ProxyHandlerAction.doDefault, {
        get,
        set
    }));
    functions_1.reflect.defineMetadata(MetadataKey, new functions_1.ReadonlyMap(), result);
    return result;
    function get(target, key) {
        const value = functions_1.reflect.get(target, key);
        return functions_1.is.object(value)
            ? new Proxy(value, (0, functions_1.wrapProxyHandler)("reflectStorage", functions_1.ProxyHandlerAction.doDefault, {
                get,
                set
            }))
            : value;
    }
    function set(target, key, value) {
        const oldValue = functions_1.reflect.get(target, key);
        if (functions_1.reflect.set(target, key, value)) {
            if (value === oldValue) {
                // Not modified
            }
            else {
                const callbacks = functions_1.reflect.getMetadata(MetadataKey, result, isCallbacks);
                for (const callback of callbacks.values())
                    callback();
            }
            return true;
        }
        return false;
    }
}, {
    unwatch: (obj, observer) => {
        const callbacks = functions_1.reflect.getMetadata(MetadataKey, obj, isCallbacks);
        functions_1.reflect.defineMetadata(MetadataKey, functions_1.map.delete(callbacks, functions_1.as.not.empty(observer.symbol)), obj);
    },
    watch: (obj, handler, reducer) => {
        const symbol = Symbol("reflect-storage__callback");
        const callbacks = functions_1.reflect.getMetadata(MetadataKey, obj, isCallbacks);
        if (reducer) {
            let reduced = reducer(obj);
            functions_1.reflect.defineMetadata(MetadataKey, functions_1.map.set(callbacks, symbol, () => {
                const oldReduced = reduced;
                reduced = reducer(obj);
                if (reduced === oldReduced) {
                    // Not modified
                }
                else
                    handler(obj);
            }), obj);
        }
        else
            functions_1.reflect.defineMetadata(MetadataKey, functions_1.map.set(callbacks, symbol, () => {
                handler(obj);
            }), obj);
        return { resourceType: "reactive-storage__observer", symbol };
    }
});
const MetadataKey = Symbol("reflect-storage__callbacks");
const isCallbacks = functions_1.is.factory(functions_1.is.map.of, functions_1.is.symbol, functions_1.is.callable);
//# sourceMappingURL=reflect-storage.js.map