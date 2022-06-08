import { assert, defineFn, is, map, o, reflect, wrapProxyHandler } from "@skylib/functions";
export const reflectStorage = defineFn(
// eslint-disable-next-line @skylib/require-jsdoc -- Ok
(obj) => {
    if (reflect.hasMetadata(MetadataKey, obj))
        return obj;
    const result = new Proxy(obj, wrapProxyHandler("reflectStorage", "doDefault", { get, set }));
    reflect.defineMetadata(MetadataKey, new Map(), result);
    return result;
    function get(target, key) {
        // eslint-disable-next-line no-restricted-syntax -- Ok
        const value = o.get(target, key);
        return is.object(value)
            ? new Proxy(value, wrapProxyHandler("reflectStorage", "doDefault", { get, set }))
            : value;
    }
    function set(target, key, value) {
        // eslint-disable-next-line no-restricted-syntax -- Ok
        const oldValue = o.get(target, key);
        if (reflect.set(target, key, value)) {
            if (value === oldValue) {
                // Not modified
            }
            else {
                const callbacks = reflect.getMetadata(MetadataKey, result);
                assert.byGuard(callbacks, isCallbacks);
                for (const callback of callbacks.values())
                    callback();
            }
            return true;
        }
        return false;
    }
}, {
    // eslint-disable-next-line @skylib/require-jsdoc -- Ok
    unwatch: (obj, observer) => {
        assert.not.empty(observer.symbol);
        const callbacks = reflect.getMetadata(MetadataKey, obj);
        assert.byGuard(callbacks, isCallbacks);
        reflect.defineMetadata(MetadataKey, map.delete(callbacks, observer.symbol), obj);
    },
    // eslint-disable-next-line @skylib/require-jsdoc -- Ok
    watch: (obj, handler, reducer) => {
        const symbol = Symbol("reflect-storage-callback");
        const callbacks = reflect.getMetadata(MetadataKey, obj);
        assert.byGuard(callbacks, isCallbacks);
        if (reducer) {
            let reduced = reducer(obj);
            reflect.defineMetadata(MetadataKey, map.set(callbacks, symbol, () => {
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
            reflect.defineMetadata(MetadataKey, map.set(callbacks, symbol, () => {
                handler(obj);
            }), obj);
        return { _type: "ReactiveStorageObserver", symbol };
    }
});
const MetadataKey = Symbol("reflect-storage-callbacks");
const isCallbacks = is.factory(is.map.of, is.symbol, is.callable);
//# sourceMappingURL=reflect-storage.js.map