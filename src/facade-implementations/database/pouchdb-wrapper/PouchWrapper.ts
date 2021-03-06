import type { Configuration, PouchDatabaseConfiguration } from "./core";
import {
  PouchConflictError,
  PouchNotFoundError,
  PouchRetryError
} from "./core";
import { Database } from "./Database";
import type { database } from "@skylib/facades";

export class PouchWrapper implements database.Facade {
  public static readonly PouchConflictError = PouchConflictError;

  public static readonly PouchNotFoundError = PouchNotFoundError;

  public static readonly PouchRetryError = PouchRetryError;

  /**
   * Creates class instance.
   *
   * @param config - Configuration.
   * @param pouchConfig - PouchDB configuration.
   */
  public constructor(
    config: Configuration = {},
    pouchConfig: PouchDatabaseConfiguration = {}
  ) {
    this.config = config;
    this.pouchConfig = pouchConfig;
  }

  public create(
    name: string,
    options: database.DatabaseOptions = {}
  ): database.Database {
    return new Database(name, options, this.config, this.pouchConfig);
  }

  protected readonly config: Configuration;

  protected readonly pouchConfig: PouchDatabaseConfiguration;
}
