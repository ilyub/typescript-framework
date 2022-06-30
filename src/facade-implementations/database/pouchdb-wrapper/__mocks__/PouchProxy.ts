import { PouchProxy as BasePouchDBProxy } from "../PouchProxy";
import pouchdb from "pouchdb";
// eslint-disable-next-line boundaries/element-types -- Wait for @skylib/config update
import type { PouchDatabaseConfiguration } from "../core";

export class PouchProxy extends BasePouchDBProxy {
  /**
   * Creates class instance.
   *
   * @param name - Database name.
   * @param config - Database configuration.
   */
  public constructor(name: string, config: PouchDatabaseConfiguration) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires, unicorn/prefer-module -- Ok
    const plugin = require("pouchdb-adapter-memory");

    pouchdb.plugin(plugin);
    super(name, { ...config, adapter: "memory" });
  }
}
