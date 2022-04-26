import { PouchDBProxy } from "./PouchDBProxy";
import {
  PouchConflictError,
  PouchNotFoundError,
  PouchRetryError
} from "./errors";
import {
  database,
  datetime,
  handlePromise,
  reactiveStorage,
  uniqueId
} from "@skylib/facades";
import {
  a,
  assert,
  cast,
  fn,
  is,
  json,
  num,
  o,
  programFlow
} from "@skylib/functions";
import * as _ from "@skylib/lodash-commonjs-es";
import { collate } from "pouchdb-collate";
import sha256 from "sha256";
import type {
  Changes,
  PouchDatabase,
  PouchDatabaseConfiguration,
  PouchQueryResponse
} from "./PouchDBProxy";
import type {
  numbers,
  numberU,
  strings,
  unknowns,
  Writable
} from "@skylib/functions";

export const handlers = o.freeze({
  error(error: unknown): void {
    throw error;
  }
});

export class Database implements database.Database {
  /**
   * Creates class instance.
   *
   * @param name - Database name.
   * @param options - Database options.
   * @param config - Configuration.
   * @param pouchConfig - PouchDB configuration.
   */
  public constructor(
    name: string,
    options: database.DatabaseOptions = {},
    config: Configuration = {},
    pouchConfig: PouchDatabaseConfiguration = {}
  ) {
    const optionsWithDefaults: Required<database.DatabaseOptions> = {
      ...options,
      caseSensitiveSorting: options.caseSensitiveSorting ?? false,
      migrations: options.migrations ?? [],
      retries: options.retries ?? 0
    };

    const configWithDefaults: Required<Configuration> = {
      ...config,
      reindexThreshold: config.reindexThreshold ?? 1
    };

    this.name = name;
    this.options = optionsWithDefaults;
    this.config = configWithDefaults;
    this.pouchConfig = pouchConfig;
  }

  public async bulkDocs(
    docs: database.PutDocuments
  ): Promise<database.PutResponses> {
    for (const doc of docs) validatePutDocument(doc);

    docs = docs.map(doc => o.omit(doc, "lastAttachedDocs"));

    const db = await this.getDb();

    const responses = await db.bulkDocs(docs);

    return responses
      .map(response =>
        "ok" in response && response.ok
          ? { id: response.id, rev: response.rev }
          : undefined
      )
      .filter(is.not.empty);
  }

  public async bulkDocsAttached(
    docs: database.BulkAttachedDocuments
  ): Promise<database.PutAttachedResponses> {
    const responses = await Promise.all(
      _.uniq(docs.map(doc => doc.parentDoc._id)).map(
        async parentId =>
          await fn.run(
            async () =>
              await this.putAttachedBulk(
                parentId,
                docs.filter(doc => doc.parentDoc._id === parentId)
              )
          )
      )
    );

    return _.flatten(responses);
  }

  public async count(conditions: database.Conditions = {}): Promise<number> {
    const response = await this.rawQuery({}, { conditions, count: true });

    return response.count;
  }

  public async countAttached(
    conditions: database.Conditions = {},
    parentConditions: database.Conditions = {}
  ): Promise<number> {
    const response = await this.rawQuery(
      {},
      {
        conditions,
        count: true,
        parentConditions
      }
    );

    return response.count;
  }

  public async exists(id: string): Promise<boolean> {
    const doc = await this.getIfExists(id);

    return is.not.empty(doc);
  }

  public async existsAttached(id: number, parentId: string): Promise<boolean> {
    const doc = await this.getIfExistsAttached(id, parentId);

    return is.not.empty(doc);
  }

  public async get(id: string): Promise<database.ExistingDocument> {
    const db = await this.getDb();

    const doc = await db.get(id);

    return extractDoc(doc);
  }

  public async getAttached(
    id: number,
    parentId: string
  ): Promise<database.ExistingAttachedDocument> {
    const db = await this.getDb();

    const doc = await db.get(parentId);

    return extractDocAttached(doc, id);
  }

  public async getIfExists(
    id: string
  ): Promise<database.ExistingDocument | undefined> {
    try {
      return await this.get(id);
    } catch (e) {
      assert.instance(e, PouchNotFoundError, wrapError(e));

      return undefined;
    }
  }

  public async getIfExistsAttached(
    id: number,
    parentId: string
  ): Promise<database.ExistingAttachedDocument | undefined> {
    try {
      return await this.getAttached(id, parentId);
    } catch (e) {
      assert.instance(e, PouchNotFoundError, wrapError(e));

      return undefined;
    }
  }

  /**
   * Returns original PouchDB database.
   *
   * @returns Original PouchDB database.
   */
  public async getRawDb(): Promise<PouchDatabase> {
    const db = await this.getDb();

    return db.db;
  }

  public async put(doc: database.PutDocument): Promise<database.PutResponse> {
    validatePutDocument(doc);

    const db = await this.getDb();

    if (doc.attachedDocs && doc.attachedDocs.length === 0) {
      assert.not.empty(doc._id);
      assert.not.empty(doc._rev);

      const storedDoc = await db.get(doc._id);

      assert.not.empty(storedDoc.attachedDocs);
      doc = { ...doc, attachedDocs: storedDoc.attachedDocs };
    }

    const response = await db.post(o.omit(doc, "lastAttachedDocs"));

    assert.toBeTrue(response.ok);

    return { id: response.id, rev: response.rev };
  }

  public async putAttached(
    parentId: string,
    doc: database.PutAttachedDocument
  ): Promise<database.PutAttachedResponse> {
    return a.first(await this.putAttachedBulk(parentId, [doc]));
  }

  public async putAttachedBulk(
    parentId: string,
    docs: database.PutAttachedDocuments
  ): Promise<database.PutAttachedResponses> {
    const db = await this.getDb();

    for (let i = 0; i < 1 + this.options.retries; i++) {
      // eslint-disable-next-line no-await-in-loop -- ???
      const result = await attempt();

      if (result) return result;
    }

    throw new PouchRetryError(`Failed after ${this.options.retries} retries`);

    async function attempt(): Promise<
      database.PutAttachedResponses | undefined
    > {
      const parentDoc = await db.get(parentId);

      const attachedDocs = a.clone(parentDoc.attachedDocs ?? []);

      const lastAttachedDocs: Writable<numbers> = [];

      const result: Writable<database.PutAttachedResponses> = [];

      for (const doc of docs) {
        const { _id, _rev, parentDoc: omitParentDoc, ...content } = doc;

        if (is.not.empty(_id) && _rev !== a.get(attachedDocs, _id)._rev)
          throw new PouchConflictError("Attached document update conflict");

        const id = _id ?? attachedDocs.length;

        const rev = (_rev ?? 0) + 1;

        const attachedDoc: database.BaseStoredAttachedDocument = {
          ...content,
          _id: id,
          _rev: rev
        };

        if (id < attachedDocs.length) attachedDocs[id] = attachedDoc;
        else attachedDocs.push(attachedDoc);

        lastAttachedDocs.push(id);

        result.push({
          id,
          parentId,
          parentRev: "",
          rev
        });
      }

      try {
        const response = await db.put(
          o.omit({
            ...parentDoc,
            attachedDocs,
            lastAttachedDocs
          })
        );

        assert.toBeTrue(response.ok, "Database request failed");

        return result.map(item => {
          return { ...item, parentRev: response.rev };
        });
      } catch (e) {
        assert.instance(e, PouchConflictError, wrapError(e));

        return undefined;
      }
    }
  }

  public async putIfNotExists(
    doc: database.PutDocument
  ): Promise<database.PutResponse | undefined> {
    try {
      return await this.put(doc);
    } catch (e) {
      assert.instance(e, PouchConflictError, wrapError(e));

      return undefined;
    }
  }

  public async putIfNotExistsAttached(
    parentId: string,
    doc: database.PutAttachedDocument
  ): Promise<database.PutAttachedResponse | undefined> {
    try {
      return await this.putAttached(parentId, doc);
    } catch (e) {
      assert.instance(e, PouchConflictError, wrapError(e));

      return undefined;
    }
  }

  public async query(
    conditions: database.Conditions = {},
    options: database.QueryOptions = {}
  ): Promise<database.ExistingDocuments> {
    const response = await this.rawQuery(options, { conditions, docs: true });

    assert.array.of(response.docs, isExistingDocument);

    return response.docs;
  }

  public async queryAttached(
    conditions: database.Conditions = {},
    parentConditions: database.Conditions = {},
    options: database.QueryOptions = {}
  ): Promise<database.ExistingAttachedDocuments> {
    const response = await this.rawQuery(options, {
      conditions,
      docs: true,
      parentConditions
    });

    assert.array.of(response.docs, isExistingDocumentAttached);

    return response.docs;
  }

  public reactiveCount(
    config: database.ReactiveConfig
  ): database.ReactiveResponse<number> {
    return this.reactiveFactoryQuery(this.count.bind(this), config);
  }

  public reactiveCountAttached(
    config: database.ReactiveConfigAttached
  ): database.ReactiveResponse<number> {
    return this.reactiveFactoryQueryAttached(
      this.countAttached.bind(this),
      config
    );
  }

  public reactiveExists(id: string): database.ReactiveResponse<boolean> {
    return this.reactiveFactoryGet(
      this.exists(id),
      this.reactiveHandlerExists(id)
    );
  }

  public reactiveExistsAttached(
    id: number,
    parentId: string
  ): database.ReactiveResponse<boolean> {
    return this.reactiveFactoryGetAttached(
      this.existsAttached(id, parentId),
      this.reactiveHandlerExistsAttached(id, parentId)
    );
  }

  public reactiveGet(
    id: string
  ): database.ReactiveResponse<database.ExistingDocument> {
    return this.reactiveFactoryGet(this.get(id), this.reactiveHandlerGet(id));
  }

  public reactiveGetAttached(
    id: number,
    parentId: string
  ): database.ReactiveResponse<database.ExistingAttachedDocument> {
    return this.reactiveFactoryGetAttached(
      this.getAttached(id, parentId),
      this.reactiveHandlerGetAttached(id, parentId)
    );
  }

  public reactiveGetIfExists(
    id: string
  ): database.ReactiveResponse<database.ExistingDocument | undefined> {
    return this.reactiveFactoryGet(
      this.getIfExists(id),
      this.reactiveHandlerGetIfExists(id)
    );
  }

  public reactiveGetIfExistsAttached(
    id: number,
    parentId: string
  ): database.ReactiveResponse<database.ExistingAttachedDocument | undefined> {
    return this.reactiveFactoryGetAttached(
      this.getIfExistsAttached(id, parentId),
      this.reactiveHandlerGetAttachedIfExists(id, parentId)
    );
  }

  public reactiveQuery(
    config: database.ReactiveConfig
  ): database.ReactiveResponse<database.ExistingDocuments> {
    return this.reactiveFactoryQuery(this.query.bind(this), config);
  }

  public reactiveQueryAttached(
    config: database.ReactiveConfigAttached
  ): database.ReactiveResponse<database.ExistingAttachedDocuments> {
    return this.reactiveFactoryQueryAttached(
      this.queryAttached.bind(this),
      config
    );
  }

  public reactiveUnsettled(
    config: database.ReactiveConfig
  ): database.ReactiveResponse<number> {
    return this.reactiveFactoryQuery(this.unsettled.bind(this), config);
  }

  public reactiveUnsettledAttached(
    config: database.ReactiveConfigAttached
  ): database.ReactiveResponse<number> {
    return this.reactiveFactoryQueryAttached(
      this.unsettledAttached.bind(this),
      config
    );
  }

  public async reset(callback?: database.ResetCallback): Promise<void> {
    const db = await this.getDb();

    await db.destroy();
    this.db = undefined;
    this.refreshSubscription();
    await callback?.call(this);
    await this.getDb();
  }

  public subscribe(handler: database.ChangesHandler): database.SubscriptionId {
    const id = database.uniqueSubscriptionId();

    this.changesHandlersPool.set(id, handler);
    this.refreshSubscription();

    return id;
  }

  public subscribeAttached(
    handler: database.AttachedChangesHandler
  ): database.AttachedSubscriptionId {
    const id = database.uniqueAttachedSubscriptionId();

    this.changesHandlersAttachedPool.set(id, handler);
    this.refreshSubscription();

    return id;
  }

  public async unsettled(
    conditions: database.Conditions = {},
    options: database.QueryOptions = {}
  ): Promise<number> {
    const response = await this.rawQuery(options, {
      conditions,
      unsettledCount: true
    });

    return response.unsettledCount;
  }

  public async unsettledAttached(
    conditions: database.Conditions = {},
    parentConditions: database.Conditions = {},
    options: database.QueryOptions = {}
  ): Promise<number> {
    const response = await this.rawQuery(options, {
      conditions,
      parentConditions,
      unsettledCount: true
    });

    return response.unsettledCount;
  }

  public unsubscribe(id: database.SubscriptionId): void {
    assert.toBeTrue(this.changesHandlersPool.has(id));
    this.changesHandlersPool.delete(id);
    this.refreshSubscription();
  }

  public unsubscribeAttached(id: database.AttachedSubscriptionId): void {
    assert.toBeTrue(this.changesHandlersAttachedPool.has(id));
    this.changesHandlersAttachedPool.delete(id);
    this.refreshSubscription();
  }

  // eslint-disable-next-line @skylib/prefer-readonly-props -- Ok
  protected changes: Changes | undefined = undefined;

  protected readonly changesHandlersAttachedPool = new Map<
    database.AttachedSubscriptionId,
    database.AttachedChangesHandler
  >();

  protected readonly changesHandlersPool = new Map<
    database.SubscriptionId,
    database.ChangesHandler
  >();

  protected readonly config: Required<Configuration>;

  // eslint-disable-next-line @skylib/prefer-readonly-props -- Ok
  protected db: PouchDBProxy | undefined = undefined;

  protected readonly name: string;

  protected readonly options: Required<database.DatabaseOptions>;

  protected readonly pouchConfig: PouchDatabaseConfiguration;

  /**
   * Returns PouchDBProxy instance.
   *
   * @returns PouchDBProxy instance.
   */
  protected async getDb(): Promise<PouchDBProxy> {
    if (is.empty(this.db)) {
      this.db = new PouchDBProxy(this.name, this.pouchConfig);
      this.refreshSubscription();
      await this.migrate();
    }

    return this.db;
  }

  /**
   * Creates map/reduce.
   *
   * @param options - Options.
   * @param rawQueryOptions - Raw query options.
   * @returns Map/reduce.
   */
  protected mapReduce(
    options: database.QueryOptions,
    rawQueryOptions: RawQueryOptions
  ): MapReduce {
    const conds = condsToStr("doc", rawQueryOptions.conditions);

    const sortBy = options.sortBy;

    const descending = options.descending ?? false;

    const group1 = descending ? 4 : 1;

    const group2 = descending ? 3 : 2;

    const group3 = descending ? 2 : 3;

    const group4 = descending ? 1 : 4;

    const idParams = [
      conds.toEmit,
      conds.toSettle,
      sortBy,
      descending,
      this.options.caseSensitiveSorting
    ];

    const keyCode = fn.run(() => {
      if (is.empty(sortBy)) return `const key = [${group2}, null, doc._id];`;

      return this.options.caseSensitiveSorting
        ? `
          const value = doc.${sortBy};
          const key = value === undefined || value === null || value === ""
            ? [${group3}, null, doc._id]
            : [${group4}, value, doc._id];
        `
        : `
          const value = typeof doc.${sortBy} === "string"
            ? doc.${sortBy}.toLocaleLowerCase()
            : doc.${sortBy};
          const key = value === undefined || value === null || value === ""
            ? [${group3}, null, doc._id]
            : [${group4}, value, doc._id];
        `;
    });

    const map = uglify(`
      function (doc) {
        /* ${uniqueId()} */
        if (${conds.toEmit}) {
          ${keyCode}
          const settled = ${conds.toSettle};
          emit(
            settled ? key : [${group1}, null, null, doc._id],
            {
              count: 1,
              docs: [
                {
                  doc: doc.attachedDocs ? { ...doc, attachedDocs: [] } : doc,
                  key
                }
              ],
              settled
            }
          );
        }
      }
    `);

    const reduce = uglify(`
      function (keys, values, rereduce) {
        /* ${uniqueId()} */
        let count = 0;
        let docs = [];
        let settled = false;
        for (const value of values) {
          count += value.count;
          if (value.settled) docs = value.docs;
          else docs.push(...value.docs);
          settled = value.settled;
        }
        return { count, docs, settled };
      }
    `);

    return {
      groupLevel: rawQueryOptions.count ?? false ? 1 : 3,
      id: sha256(json.encode(idParams)),
      mapReduce: { map, reduce },
      output: createFilter(conds.toOutput),
      settle: createFilter(conds.toSettle)
    };

    function createFilter(cond: string): Filter {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, no-type-assertion/no-type-assertion -- ???
      return new Function("doc", `return ${cond};`) as Filter;
    }
  }

  /**
   * Creates map/reduce.
   *
   * @param options - Options.
   * @param rawQueryOptions - Raw query options.
   * @returns Map/reduce.
   */
  protected mapReduceAttached(
    options: database.QueryOptions,
    rawQueryOptions: RawQueryOptionsAttached
  ): MapReduce {
    const conds = condsToStr("attached", rawQueryOptions.conditions);

    const parentConds = condsToStr("doc", rawQueryOptions.parentConditions);

    const sortBy = options.sortBy;

    const descending = options.descending ?? false;

    const group1 = descending ? 4 : 1;

    const group2 = descending ? 3 : 2;

    const group3 = descending ? 2 : 3;

    const group4 = descending ? 1 : 4;

    const idParams = [
      conds.toEmit,
      conds.toSettle,
      parentConds,
      sortBy,
      descending,
      this.options.caseSensitiveSorting
    ];

    const keyCode = fn.run<string>(() => {
      if (is.empty(sortBy))
        return `const key = [${group2}, null, doc._id, _id];`;

      return this.options.caseSensitiveSorting
        ? `
          const value = attached.${sortBy};
          const key = value === undefined || value === null || value === ""
            ? [${group3}, null, doc._id, _id]
            : [${group4}, value, doc._id, _id];
        `
        : `
          const value = typeof attached.${sortBy} === "string"
            ? attached.${sortBy}.toLocaleLowerCase()
            : attached.${sortBy};
          const key = value === undefined || value === null || value === ""
            ? [${group3}, null, doc._id, _id]
            : [${group4}, value, doc._id, _id];
        `;
    });

    const map = uglify(`
      function (doc) {
        /* ${uniqueId()} */
        if (doc.attachedDocs && ${parentConds.toEmit}) {
          const parentDoc = { ...doc, attachedDocs: [] };
          const parentSettled = ${parentConds.toSettle};
          for (let _id = 0; _id < doc.attachedDocs.length; _id++) {
            const attached = doc.attachedDocs[_id];
            if (!attached._deleted && ${conds.toEmit}) {
              ${keyCode}
              const settled = parentSettled && ${conds.toSettle};
              emit(
                settled ? key : [${group1}, null, null, doc._id, _id],
                {
                  count: 1,
                  docs: [
                    {
                      doc: { ...attached, parentDoc },
                      key
                    }
                  ],
                  settled
                }
              );
            }
          }
        }
      }
    `);

    const reduce = uglify(`
      function (keys, values, rereduce) {
        /* ${uniqueId()} */
        let count = 0;
        let docs = [];
        let settled = false;
        for (const value of values) {
          count += value.count;
          if (value.settled) docs = value.docs;
          else docs.push(...value.docs);
          settled = value.settled;
        }
        return { count, docs, settled };
      }
    `);

    return {
      groupLevel: rawQueryOptions.count ?? false ? 1 : 4,
      id: sha256(json.encode(idParams)),
      mapReduce: { map, reduce },
      output: createFilter(conds.toOutput, parentConds.toOutput),
      settle: createFilter(conds.toSettle, parentConds.toSettle)
    };

    function createFilter(cond1: string, cond2: string): Filter {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, no-type-assertion/no-type-assertion -- ???
      return new Function(
        "attached",
        uglify(`
          doc = attached.parentDoc;
          return ${cond1} && ${cond2};
        `)
      ) as Filter;
    }
  }

  /**
   * Runs migrations.
   */
  protected async migrate(): Promise<void> {
    if (this.options.migrations.length) {
      const defaultMigrations: database.PutDocument = { _id: "migrations" };

      const storedMigrations = await this.getIfExists("migrations");

      let migrations: database.PutDocument =
        storedMigrations ?? defaultMigrations;

      for (const migration of this.options.migrations)
        if (migrations[migration.id] === true) {
          // Already executed
        } else {
          {
            // eslint-disable-next-line no-await-in-loop -- ??
            await migration.callback.call(this);
          }

          {
            migrations = { ...migrations, [migration.id]: true };

            // eslint-disable-next-line no-await-in-loop -- ??
            const { id, rev } = await this.put(migrations);

            migrations = {
              ...migrations,
              _id: id,
              _rev: rev
            };
          }
        }
    }
  }

  /**
   * Performs database query.
   *
   * @param options - Options.
   * @param rawQueryOptions - Raw query options.
   * @returns Documents.
   */
  protected async rawQuery(
    options: database.QueryOptions,
    rawQueryOptions: RawQueryOptions | RawQueryOptionsAttached
  ): Promise<RawQueryResponse> {
    const mapReduce =
      "parentConditions" in rawQueryOptions
        ? this.mapReduceAttached(options, rawQueryOptions)
        : this.mapReduce(options, rawQueryOptions);

    const db = await this.getDb();

    const limit = options.limit;

    const skip = options.skip ?? 0;

    const response = await query();

    const toSettle = _.flatten(
      response.rows
        .map(row => row.value as unknown)
        .filter(isDocsResponse)
        .filter(docsResponse => !docsResponse.settled)
        .map(docsResponse => docsResponse.docs)
    )
      .map(doc => doc.doc)
      .filter(mapReduce.settle);

    if (toSettle.length >= this.config.reindexThreshold) await rebuildIndex();

    return {
      count: getCount(),
      docs: getDocs(),
      mapReduce,
      unsettledCount: getUnsettledCount()
    };

    async function createDesignDocument(): Promise<void> {
      try {
        await db.put({
          _id: `_design/${mapReduce.id}`,
          views: { default: mapReduce.mapReduce }
        });
      } catch (e) {
        assert.instance(e, PouchConflictError, wrapError(e));
      }
    }

    function getCount(): number {
      return rawQueryOptions.count ?? false
        ? num.sum(
            ...response.rows
              .map(row => row.value as unknown)
              .filter(isDocsResponse)
              .map(docsResponse =>
                docsResponse.settled
                  ? docsResponse.count
                  : docsResponse.docs
                      .map(docResponse => docResponse.doc)
                      .filter(mapReduce.output).length
              )
          )
        : 0;
    }

    function getDocs(): unknowns {
      if (rawQueryOptions.docs ?? false) {
        const docResponses = _.flatten(
          response.rows
            .map(row => row.value as unknown)
            .filter(isDocsResponse)
            .map(docsResponse => docsResponse.docs)
        ).filter(docResponse => mapReduce.output(docResponse.doc));

        docResponses.sort((docsResponse1, docsResponse2) =>
          collate(docsResponse1.key, docsResponse2.key)
        );

        if (options.descending ?? false) docResponses.reverse();

        return sliceDocs(docResponses).map(doc => doc.doc);
      }

      return [];
    }

    function getUnsettledCount(): number {
      return rawQueryOptions.unsettledCount ?? false
        ? num.sum(
            0,
            ...response.rows
              .map(row => row.value as unknown)
              .filter(isDocsResponse)
              .filter(docsResponse => !docsResponse.settled)
              .map(docsResponse => docsResponse.docs.length)
          )
        : 0;
    }

    async function query(): Promise<PouchQueryResponse> {
      try {
        return await queryAttempt();
      } catch (e) {
        assert.instance(e, PouchNotFoundError, wrapError(e));
        await createDesignDocument();

        return await queryAttempt();
      }
    }

    async function queryAttempt(): Promise<PouchQueryResponse> {
      return await db.query(`${mapReduce.id}/default`, {
        descending: options.descending,
        group: true,
        group_level: mapReduce.groupLevel,
        limit: is.not.empty(limit) ? limit + skip + 1 : undefined
      });
    }

    async function rebuildIndex(): Promise<void> {
      const doc = await db.get(`_design/${mapReduce.id}`);

      await db.put({ ...doc, views: { default: mapReduce.mapReduce } });
    }

    function sliceDocs<T>(docs: readonly T[]): readonly T[] {
      if (is.not.empty(options.skip))
        return is.not.empty(options.limit)
          ? docs.slice(options.skip, options.skip + options.limit)
          : docs.slice(options.skip);

      return is.not.empty(options.limit) ? docs.slice(0, options.limit) : docs;
    }
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param handler - Handler.
   * @returns Reactive response.
   */
  protected reactiveFactoryGet<T>(
    request: Promise<T>,
    handler: ReactiveHandler<T>
  ): database.ReactiveResponse<T> {
    const result = reactiveStorage<database.ReactiveResponse<T>>({
      loaded: false,
      loading: true,
      refresh: fn.noop,
      unsubscribe: fn.noop
    });

    handlePromise.silent(
      this.reactiveFactoryGetAsync(request, handler, result)
    );

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param handler - Handler.
   * @param result - Reactive result.
   * @returns Reactive response.
   */
  protected async reactiveFactoryGetAsync<T>(
    request: Promise<T>,
    handler: ReactiveHandler<T>,

    result: Writable<database.ReactiveResponse<T>>
  ): Promise<database.ReactiveResponseLoaded<T>> {
    o.assign(result, {
      loaded: true,
      loading: false,
      unsubscribe: (): void => {
        this.unsubscribe(subscription);
      },
      value: await request
    });

    assert.toBeTrue(result.loaded);

    const subscription = this.subscribe(doc => {
      assert.not.empty(result);
      assert.toBeTrue(result.loaded);
      handler(doc, result);
    });

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param handler - Handler.
   * @returns Reactive response.
   */
  protected reactiveFactoryGetAttached<T>(
    request: Promise<T>,
    handler: ReactiveHandlerAttached<T>
  ): database.ReactiveResponse<T> {
    const result = reactiveStorage<database.ReactiveResponse<T>>({
      loaded: false,
      loading: true,
      refresh: fn.noop,
      unsubscribe: fn.noop
    });

    handlePromise.silent(
      this.reactiveFactoryGetAttachedAsync(request, handler, result)
    );

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param handler - Handler.
   * @param result - Reactive result.
   * @returns Reactive response.
   */
  protected async reactiveFactoryGetAttachedAsync<T>(
    request: Promise<T>,
    handler: ReactiveHandlerAttached<T>,

    result: Writable<database.ReactiveResponse<T>>
  ): Promise<database.ReactiveResponseLoaded<T>> {
    o.assign(result, {
      loaded: true,
      loading: false,
      unsubscribe: (): void => {
        this.unsubscribeAttached(subscription);
      },
      value: await request
    });

    assert.toBeTrue(result.loaded);

    const subscription = this.subscribeAttached(doc => {
      assert.not.empty(result);
      assert.toBeTrue(result.loaded);
      handler(doc, result);
    });

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param config - Configuration.
   * @returns Reactive response.
   */
  protected reactiveFactoryQuery<T>(
    request: ReactiveRequest<T>,
    config: database.ReactiveConfig
  ): database.ReactiveResponse<T> {
    const result = reactiveStorage<database.ReactiveResponse<T>>({
      loaded: false,
      loading: true,
      refresh: fn.noop,
      unsubscribe: fn.noop
    });

    handlePromise.silent(
      this.reactiveFactoryQueryAsync(request, config, result)
    );

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param config - Configuration.
   * @param result - Reactive result.
   * @returns Reactive response.
   */
  protected async reactiveFactoryQueryAsync<T>(
    request: ReactiveRequest<T>,
    config: database.ReactiveConfig,

    result: Writable<database.ReactiveResponse<T>>
  ): Promise<database.ReactiveResponseLoaded<T>> {
    config = reactiveStorage(config);

    o.assign(result, {
      loaded: true,
      loading: false,
      unsubscribe: (): void => {
        reactiveStorage.unwatch(config, observer);
        this.unsubscribe(subscription);
        programFlow.clearTimeout(timeout);
      },
      value: await request(config.conditions, config.options)
    });

    assert.toBeTrue(result.loaded);

    const observer = reactiveStorage.watch(config, refresh);

    const subscription = this.subscribe(doc => {
      if (config.update && config.update(doc)) refresh();
    });

    let timeout: numberU;

    updateTimeout();

    return result;

    function refresh(): void {
      handlePromise.silent(async () => {
        assert.not.empty(result);
        assert.toBeTrue(result.loaded);
        result.loading = true;

        const value = await request(config.conditions, config.options);

        assert.not.empty(result);
        assert.toBeTrue(result.loaded);
        result.loading = false;
        result.value = value;
        updateTimeout();
      });
    }

    function updateTimeout(): void {
      programFlow.clearTimeout(timeout);
      timeout = is.not.empty(config.updateInterval)
        ? programFlow.setTimeout(refresh, config.updateInterval)
        : undefined;
    }
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param config - Configuration.
   * @returns Reactive response.
   */
  protected reactiveFactoryQueryAttached<T>(
    request: ReactiveRequestAttached<T>,
    config: database.ReactiveConfigAttached
  ): database.ReactiveResponse<T> {
    const result = reactiveStorage<database.ReactiveResponse<T>>({
      loaded: false,
      loading: true,
      refresh: fn.noop,
      unsubscribe: fn.noop
    });

    handlePromise.silent(
      this.reactiveFactoryQueryAttachedAsync(request, config, result)
    );

    return result;
  }

  /**
   * Reactive factory.
   *
   * @param request - Request.
   * @param config - Configuration.
   * @param result - Reactive result.
   * @returns Reactive response.
   */
  protected async reactiveFactoryQueryAttachedAsync<T>(
    request: ReactiveRequestAttached<T>,
    config: database.ReactiveConfigAttached,

    result: Writable<database.ReactiveResponse<T>>
  ): Promise<database.ReactiveResponseLoaded<T>> {
    config = reactiveStorage(config);

    o.assign(result, {
      loaded: true,
      loading: false,
      unsubscribe: (): void => {
        reactiveStorage.unwatch(config, observer);
        this.unsubscribeAttached(subscription);
        programFlow.clearTimeout(timeout);
      },
      value: await request(
        config.conditions,
        config.parentConditions,
        config.options
      )
    });

    assert.toBeTrue(result.loaded);

    const observer = reactiveStorage.watch(config, refresh);

    const subscription = this.subscribeAttached(doc => {
      if (config.update && config.update(doc)) refresh();
    });

    let timeout: numberU;

    updateTimeout();

    return result;

    function refresh(): void {
      handlePromise.silent(async () => {
        assert.not.empty(result);
        assert.toBeTrue(result.loaded);
        result.loading = true;

        const value = await request(
          config.conditions,
          config.parentConditions,
          config.options
        );

        assert.not.empty(result);
        assert.toBeTrue(result.loaded);
        result.loading = false;
        result.value = value;
        updateTimeout();
      });
    }

    function updateTimeout(): void {
      programFlow.clearTimeout(timeout);
      timeout = is.not.empty(config.updateInterval)
        ? programFlow.setTimeout(refresh, config.updateInterval)
        : undefined;
    }
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerExists(id: string): ReactiveHandler<boolean> {
    return (doc, mutableResult): void => {
      if (doc._id === id) mutableResult.value = !doc._deleted;
    };
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @param parentId - Parent ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerExistsAttached(
    id: number,
    parentId: string
  ): ReactiveHandlerAttached<boolean> {
    return (doc, mutableResult): void => {
      if (doc._id === id && doc.parentDoc._id === parentId)
        mutableResult.value = !doc._deleted;
    };
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerGet(
    id: string
  ): ReactiveHandler<database.ExistingDocument> {
    return (doc, mutableResult): void => {
      if (doc._id === id)
        if (doc._deleted)
          handlers.error(new PouchNotFoundError("Missing document"));
        else mutableResult.value = doc;
    };
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @param parentId - Parent ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerGetAttached(
    id: number,
    parentId: string
  ): ReactiveHandlerAttached<database.ExistingAttachedDocument> {
    return (doc, mutableResult): void => {
      if (doc._id === id && doc.parentDoc._id === parentId)
        if (doc._deleted)
          handlers.error(new PouchNotFoundError("Missing attached document"));
        else mutableResult.value = doc;
    };
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @param parentId - Parent ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerGetAttachedIfExists(
    id: number,
    parentId: string
  ): ReactiveHandlerAttached<database.ExistingAttachedDocument | undefined> {
    return (doc, mutableResult): void => {
      if (doc._id === id && doc.parentDoc._id === parentId)
        mutableResult.value = doc._deleted ? undefined : doc;
    };
  }

  /**
   * Reactive handler factory.
   *
   * @param id - ID.
   * @returns Reactive handler.
   */
  protected reactiveHandlerGetIfExists(
    id: string
  ): ReactiveHandler<database.ExistingDocument | undefined> {
    return (doc, mutableResult): void => {
      if (doc._id === id) mutableResult.value = doc._deleted ? undefined : doc;
    };
  }

  /**
   * Refreshes subscriptions.
   */
  protected refreshSubscription(): void {
    if (
      this.db &&
      this.changesHandlersPool.size + this.changesHandlersAttachedPool.size > 0
    )
      if (this.changes) {
        // Already exists
      } else
        this.changes = this.db.changes(
          value => {
            assert.byGuard(value.doc, isExistingDocument);

            if (this.changesHandlersPool.size) {
              const doc = extractDoc(value.doc);

              for (const handler of this.changesHandlersPool.values())
                handler(doc);
            }

            if (this.changesHandlersAttachedPool.size)
              for (const lastAttachedDoc of value.doc.lastAttachedDocs ?? []) {
                const attachedDoc = extractDocAttached(
                  value.doc,
                  lastAttachedDoc,
                  true
                );

                for (const handler of this.changesHandlersAttachedPool.values())
                  handler(attachedDoc);
              }
          },
          {
            include_docs: true,
            live: true,
            since: "now"
          }
        );
    else if (this.changes) {
      this.changes.cancel();
      this.changes = undefined;
    } else {
      // Already cancelled
    }
  }
}

export interface Configuration {
  readonly reindexThreshold?: number;
}

export interface Filter {
  /**
   * Filter function.
   *
   * @param doc - Document.
   * @returns Result.
   */
  (doc: unknown): boolean;
}

export interface MapReduce {
  readonly groupLevel: number;
  readonly id: string;
  readonly mapReduce: {
    readonly map: string;
    readonly reduce: string;
  };
  readonly output: Filter;
  readonly settle: Filter;
}

export interface RawQueryOptions {
  readonly conditions: database.Conditions;
  readonly count?: true;
  readonly docs?: true;
  readonly unsettledCount?: true;
}

export interface RawQueryOptionsAttached extends RawQueryOptions {
  readonly parentConditions: database.Conditions;
}

export interface RawQueryResponse {
  readonly count: number;
  readonly docs: unknowns;
  readonly mapReduce: MapReduce;
  readonly unsettledCount: number;
}

export interface ReactiveHandler<T> {
  /**
   * Reactive handler.
   *
   * @param doc - Document.
   * @param mutableResult - Mutable result.
   */
  (
    doc: database.ExistingDocument,
    mutableResult: Writable<database.ReactiveResponseLoaded<T>>
  ): void;
}

export interface ReactiveHandlerAttached<T> {
  /**
   * Reactive handler.
   *
   * @param doc - Document.
   * @param mutableResult - Mutable result.
   */
  (
    doc: database.ExistingAttachedDocument,
    mutableResult: Writable<database.ReactiveResponseLoaded<T>>
  ): void;
}

export interface ReactiveRequest<T> {
  /**
   * Reactive request.
   *
   * @param conditions - Conditions.
   * @param options - Options.
   * @returns Promise.
   */
  (
    conditions?: database.Conditions,
    options?: database.QueryOptions
  ): Promise<T>;
}

export interface ReactiveRequestAttached<T> {
  /**
   * Reactive request.
   *
   * @param conditions - Conditions.
   * @param parentConditions - Parent conditions.
   * @param options - Options.
   * @returns Promise.
   */
  (
    conditions?: database.Conditions,
    parentConditions?: database.Conditions,
    options?: database.QueryOptions
  ): Promise<T>;
}

/**
 * Wraps error.
 *
 * @param e - Error.
 * @returns Wrapped error.
 */
export function wrapError<T>(e: T): () => T {
  return () => e;
}

const isDocResponse = is.object.factory<DocResponse>(
  { doc: is.unknown, key: is.unknown },
  {}
);

const isDocResponses = is.factory(is.array.of, isDocResponse);

const isDocsResponse = is.object.factory<DocsResponse>(
  {
    count: is.number,
    docs: isDocResponses,
    settled: is.boolean
  },
  {}
);

const isBaseExistingDocument = is.object.factory<database.BaseExistingDocument>(
  { _id: is.string, _rev: is.string },
  {
    _deleted: is.true,
    attachedDocs: isStoredDocumentAttachedArray,
    lastAttachedDocs: is.numbers
  }
);

const isStoredDocumentAttached =
  is.object.factory<database.BaseStoredAttachedDocument>(
    { _id: is.number, _rev: is.number },
    { _deleted: is.true, parentDoc: isBaseExistingDocument }
  );

const isExistingDocument = is.object.factory<database.ExistingDocument>(
  { _id: is.string, _rev: is.string },
  {
    _deleted: is.true,
    attachedDocs: isStoredDocumentAttachedArray,
    lastAttachedDocs: is.numbers
  }
);

const isExistingDocumentAttached =
  is.object.factory<database.ExistingAttachedDocument>(
    {
      _id: is.number,
      _rev: is.number,
      parentDoc: isExistingDocument
    },
    { _deleted: is.true }
  );

interface DocResponse {
  readonly doc: unknown;
  readonly key: unknown;
}

type DocResponses = readonly DocResponse[];

interface DocsResponse {
  readonly count: number;
  readonly docs: DocResponses;
  readonly settled: boolean;
}

interface StrConds {
  readonly toEmit: string;
  readonly toOutput: string;
  readonly toSettle: string;
}

/**
 * Joins condition strings with boolean "and" operator.
 *
 * @param conditions - Condition strings.
 * @returns Joined condition string.
 */
function and(conditions: strings): string {
  conditions = conditions.filter(condition => condition !== "true");

  if (conditions.length === 0) return "true";

  assert.toBeFalse(conditions.includes("false"));

  return conditions.join(" && ");
}

/**
 * Converts conditions to condition strings.
 *
 * @param source - Source.
 * @param conditions - Conditions.
 * @returns Condition strings.
 */
function condsToStr(
  source: "attached" | "doc",
  conditions: database.Conditions
): StrConds {
  conditions = is.array(conditions) ? conditions : [conditions];

  const toEmit: Writable<strings> = [];

  const toOutput: Writable<strings> = [];

  const toSettle: Writable<strings> = [];

  for (const conditionsGroup of conditions)
    for (const [key, fieldConditions] of o.entries(conditionsGroup)) {
      const dest = `${source}.${key}`;

      const destDelta = `new Date(${dest}).getTime() - Date.now()`;

      if ("isSet" in fieldConditions)
        toEmit.push(
          fieldConditions.isSet
            ? `(${dest} !== null && ${dest} !== undefined)`
            : `(${dest} === null || ${dest} === undefined)`
        );

      if ("eq" in fieldConditions)
        toEmit.push(`(${dest} === ${escapeForJs(fieldConditions.eq)})`);

      if ("neq" in fieldConditions)
        toEmit.push(`(${dest} !== ${escapeForJs(fieldConditions.neq)})`);

      if ("gt" in fieldConditions)
        toEmit.push(`(${dest} > ${escapeForJs(fieldConditions.gt)})`);

      if ("gte" in fieldConditions)
        toEmit.push(`(${dest} >= ${escapeForJs(fieldConditions.gte)})`);

      if ("lt" in fieldConditions)
        toEmit.push(`(${dest} < ${escapeForJs(fieldConditions.lt)})`);

      if ("lte" in fieldConditions)
        toEmit.push(`(${dest} <= ${escapeForJs(fieldConditions.lte)})`);

      if ("dateEq" in fieldConditions) {
        const value = dateValue(fieldConditions.dateEq);

        const delta = dateDelta(value);

        toEmit.push(`(${dest} && ${destDelta} > ${delta})`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} === ${escapeForJs(value)})`);
      }

      if ("dateNeq" in fieldConditions) {
        const value = dateValue(fieldConditions.dateNeq);

        const delta = dateDelta(value);

        toEmit.push(`(${dest} && ${destDelta} > ${delta})`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} !== ${escapeForJs(value)})`);
      }

      if ("dateGt" in fieldConditions) {
        const value = dateValue(fieldConditions.dateGt);

        const delta = dateDelta(value);

        toEmit.push(`(${dest} && ${destDelta} > ${delta})`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} > ${escapeForJs(value)})`);
      }

      if ("dateGte" in fieldConditions) {
        const value = dateValue(fieldConditions.dateGte);

        const delta = dateDelta(value);

        toEmit.push(`(${dest} && ${destDelta} > ${delta})`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} >= ${escapeForJs(value)})`);
      }

      if ("dateLt" in fieldConditions) {
        const value = dateValue(fieldConditions.dateLt);

        const delta = dateDelta(value);

        toEmit.push(`${dest}`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} < ${escapeForJs(value)})`);
      }

      if ("dateLte" in fieldConditions) {
        const value = dateValue(fieldConditions.dateLte);

        const delta = dateDelta(value);

        toEmit.push(`${dest}`);
        toSettle.push(`(${destDelta} < ${delta})`);
        toOutput.push(`(${dest} <= ${escapeForJs(value)})`);
      }
    }

  return {
    toEmit: and(toEmit),
    toOutput: and(toOutput),
    toSettle: and(toSettle)
  };
}

// eslint-disable-next-line @skylib/require-jsdoc -- ???
function dateDelta(date: string): number {
  return num.round.step(
    datetime.create(date).toTime() - datetime.time() - 50 * 3600 * 1000,
    3600 * 1000
  );
}

// eslint-disable-next-line @skylib/require-jsdoc -- ???
function dateValue(date: database.DateCondition): string {
  if (is.string(date)) return date;

  if (date.length === 1) date = [date[0], "+", 0, "minutes"];

  const [type, sign, value, unit] = date;

  const result = datetime.create();

  switch (type) {
    case "endOfDay":
      result.setStartOfDay().add(1, "day");

      break;

    case "endOfHour":
      result.setStartOfHour().add(1, "hour");

      break;

    case "endOfMonth":
      result.setStartOfMonth().add(1, "month");

      break;

    case "endOfWeek":
      result.setStartOfWeekLocale().add(1, "week");

      break;

    case "now":
      break;

    case "startOfDay":
      result.setStartOfDay();

      break;

    case "startOfHour":
      result.setStartOfHour();

      break;

    case "startOfMonth":
      result.setStartOfMonth();

      break;

    case "startOfWeek":
      result.setStartOfWeekLocale();

      break;
  }

  switch (sign) {
    case "-":
      result.sub(value, unit);

      break;

    case "+":
      result.add(value, unit);
  }

  return result.toString();
}

/**
 * Escapes value for use in map/reduce functions.
 *
 * @param value - Value.
 * @returns Escaped value.
 */
function escapeForJs(value: unknown): string {
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";

    case "number":
      return cast.string(value);

    case "string":
      return json.encode(value);

    default:
      throw new Error(`Unexpected value type: ${typeof value}`);
  }
}

/**
 * Extracts document.
 *
 * @param rawDoc - Raw document.
 * @returns Document.
 */
function extractDoc(
  rawDoc: database.ExistingDocument
): database.ExistingDocument {
  return rawDoc.attachedDocs ? { ...rawDoc, attachedDocs: [] } : rawDoc;
}

/**
 * Extracts attached document.
 *
 * @param rawDoc - Document.
 * @param id - Attached document ID.
 * @param extractDeleted - Extract deleted documents.
 * @returns Attached document.
 */
function extractDocAttached(
  rawDoc: database.ExistingDocument,
  id: number,
  extractDeleted = false
): database.ExistingAttachedDocument {
  const { attachedDocs, ...parentDoc } = rawDoc;

  assert.not.empty(
    attachedDocs,
    () => new PouchNotFoundError("Missing attached document")
  );

  const attachedDoc = attachedDocs[id];

  assert.not.empty(
    attachedDoc,
    () => new PouchNotFoundError("Missing attached document")
  );

  assert.toBeTrue(
    extractDeleted || is.empty(attachedDoc._deleted),
    () => new PouchNotFoundError("Missing attached document")
  );

  return { ...attachedDoc, parentDoc: { ...parentDoc, attachedDocs: [] } };
}

// eslint-disable-next-line @skylib/require-jsdoc -- ??
function isStoredDocumentAttachedArray(
  value: unknown
): value is database.BaseStoredAttachedDocuments {
  return is.array.of(value, isStoredDocumentAttached);
}

/**
 * Uglify javascript code.
 *
 * @param code - Code.
 * @returns Uglified code.
 */
function uglify(code: string): string {
  return code.trim().replace(/\s+/gu, " ");
}

/**
 * Validates document.
 *
 * @param doc - Document.
 */
function validatePutDocument(doc: database.PutDocument): void {
  if (o.hasOwnProp("_attachments", doc))
    throw new Error("Put document contains reserved word: _attachments");

  if (o.hasOwnProp("_conflicts", doc))
    throw new Error("Put document contains reserved word: _conflicts");

  if (o.hasOwnProp("filters", doc))
    throw new Error("Put document contains reserved word: filters");

  if (o.hasOwnProp("views", doc))
    throw new Error("Put document contains reserved word: views");

  if (
    doc.attachedDocs?.some((attachedDoc, index) => attachedDoc._id !== index) ??
    false
  )
    throw new Error("Invalid attached document");
}
