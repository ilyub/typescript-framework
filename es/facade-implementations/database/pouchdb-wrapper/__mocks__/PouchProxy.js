import { PouchProxy as BasePouchDBProxy } from "../PouchProxy";
import pouchdb from "pouchdb";
export class PouchProxy extends BasePouchDBProxy {
    /**
     * Creates class instance.
     *
     * @param name - Database name.
     * @param config - Database configuration.
     */
    constructor(name, config) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Ok
        const plugin = require("pouchdb-adapter-memory");
        pouchdb.plugin(plugin);
        super(name, Object.assign(Object.assign({}, config), { adapter: "memory" }));
    }
}
//# sourceMappingURL=PouchProxy.js.map