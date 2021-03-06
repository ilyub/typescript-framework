"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
class Engine {
    /**
     * Creates class instance.
     *
     * @param idField - ID field.
     * @param fields - Searchable fields.
     * @param items - Items.
     * @param buildIndex - Index builder.
     */
    constructor(idField, fields, items, buildIndex) {
        Object.defineProperty(this, "idField", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "index", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.idField = idField;
        this.index = buildIndex(idField, fields, items);
        this.items = items;
    }
}
exports.Engine = Engine;
//# sourceMappingURL=Engine.js.map