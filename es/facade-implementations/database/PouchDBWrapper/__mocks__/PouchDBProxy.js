import { PouchDBProxy as BasePouchDBProxy } from "../PouchDBProxy";
export { handlers } from "../PouchDBProxy";
export class PouchDBProxy extends BasePouchDBProxy {
    /**
     * Creates class instance.
     *
     * @param name - Database name.
     * @param options - Database options.
     */
    constructor(name, options) {
        super(name, Object.assign(Object.assign({}, options), { adapter: "memory" }));
    }
    /*
    |*****************************************************************************
    |* Protected
    |*****************************************************************************
    |*/
    async getPouchDBConstructor() {
        const pouchDBConstructor = await super.getPouchDBConstructor();
        const pouchdbAdapterMemory = await import(
        /* webpackChunkName: "pouchdb-adapter-memory" */
        "pouchdb-adapter-memory");
        pouchDBConstructor.plugin(pouchdbAdapterMemory.default);
        return pouchDBConstructor;
    }
}
//# sourceMappingURL=PouchDBProxy.js.map