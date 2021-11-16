import * as _ from "lodash";
import { collate } from "pouchdb-collate";
import sha256 from "sha256";

import type {
  ChangesHandler,
  ChangesHandlerAttached,
  Conditions,
  Database as DatabaseInterface,
  DatabaseOptions,
  ExistingDocument,
  ExistingDocumentAttached,
  PutDocument,
  PutDocumentAttached,
  PutResponse,
  PutResponseAttached,
  QueryOptions,
  ResetCallback,
  StoredDocumentAttached
} from "@skylib/facades/dist/database";
import { uniqueId } from "@skylib/facades/dist/uniqueId";
import * as a from "@skylib/functions/dist/array";
import * as assert from "@skylib/functions/dist/assertions";
import * as cast from "@skylib/functions/dist/converters";
import * as fn from "@skylib/functions/dist/function";
import * as is from "@skylib/functions/dist/guards";
import * as json from "@skylib/functions/dist/json";
import * as num from "@skylib/functions/dist/number";
import * as o from "@skylib/functions/dist/object";

import { PouchConflictError } from "./errors/PouchConflictError";
import { PouchNotFoundError } from "./errors/PouchNotFoundError";
import { PouchRetryError } from "./errors/PouchRetryError";
import type {
  Changes,
  PouchDatabase,
  PouchDatabaseConfiguration,
  PouchQueryResponse
} from "./PouchDBProxy";
import { PouchDBProxy } from "./PouchDBProxy";

export interface Configuration {
  readonly reindexThreshold?: number;
}

export type Filter = (doc: unknown) => boolean;

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
  readonly conditions: Conditions;
  readonly count?: true;
  readonly docs?: true;
  readonly unsettledCount?: true;
}

export interface RawQueryOptionsAttached extends RawQueryOptions {
  readonly parentConditions: Conditions;
}

export interface RawQueryResponse {
  readonly count: number;
  readonly docs: readonly unknown[];
  readonly mapReduce: MapReduce;
  readonly unsettledCount: number;
}

export class Database implements DatabaseInterface {
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
    options: DatabaseOptions = {},
    config: Configuration = {},
    pouchConfig: PouchDatabaseConfiguration = {}
  ) {
    const optionsWithDefaults: Required<DatabaseOptions> = {
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

  public async bulkDocs(docs: readonly PutDocument[]): Promise<PutResponse[]> {
    for (const doc of docs) validatePutDocument(doc);

    docs = docs.map(doc => o.omit(doc, "lastAttachedDoc"));

    const db = await this.getDb();

    const responses = await db.bulkDocs(docs);

    return responses
      .map(response =>
        "ok" in response && response.ok
          ? {
              id: response.id,
              rev: response.rev
            }
          : undefined
      )
      .filter(is.not.empty);
  }

  public async count(conditions: Conditions): Promise<number> {
    const response = await this.rawQuery({}, { conditions, count: true });

    return response.count;
  }

  public async countAttached(
    conditions: Conditions,
    parentConditions: Conditions = {}
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

  public async get(id: string): Promise<ExistingDocument> {
    const db = await this.getDb();

    const doc = await db.get(id);

    return extractDoc(doc);
  }

  public async getAttached(
    id: number,
    parentId: string
  ): Promise<ExistingDocumentAttached> {
    const db = await this.getDb();

    const doc = await db.get(parentId);

    return extractDocAttached(doc, id);
  }

  public async getIfExists(id: string): Promise<ExistingDocument | undefined> {
    try {
      return await this.get(id);
    } catch (e) {
      assert.instance(e, PouchNotFoundError, assert.toErrorArg(e));

      return undefined;
    }
  }

  public async getIfExistsAttached(
    id: number,
    parentId: string
  ): Promise<ExistingDocumentAttached | undefined> {
    try {
      return await this.getAttached(id, parentId);
    } catch (e) {
      assert.instance(e, PouchNotFoundError, assert.toErrorArg(e));

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

    return db.getDb();
  }

  public async put(doc: PutDocument): Promise<PutResponse> {
    validatePutDocument(doc);

    const db = await this.getDb();

    if (doc.attachedDocs && doc.attachedDocs.length === 0) {
      assert.not.empty(doc._id);
      assert.not.empty(doc._rev);

      const storedDoc = await db.get(doc._id);

      assert.not.empty(storedDoc.attachedDocs);
      doc = { ...doc, attachedDocs: storedDoc.attachedDocs };
    }

    const response = await db.post(o.omit(doc, "lastAttachedDoc"));

    assert.toBeTrue(response.ok);

    return {
      id: response.id,
      rev: response.rev
    };
  }

  public async putAttached(
    parentId: string,
    doc: PutDocumentAttached
  ): Promise<PutResponseAttached> {
    const db = await this.getDb();

    const { _id, _rev, parentDoc: omitParentDoc, ...content } = doc;

    for (let i = 0; i < 1 + this.options.retries; i++) {
      // eslint-disable-next-line no-await-in-loop
      const result = await attempt();

      if (is.object(result)) return result;
    }

    throw new PouchRetryError(`Failed after ${this.options.retries} retries`);

    async function attempt(): Promise<PutResponseAttached | "retry"> {
      const parentDoc = await db.get(parentId);

      const attachedDocs = parentDoc.attachedDocs ?? [];

      if (is.not.empty(_id) && _rev !== a.get(attachedDocs, _id)._rev)
        throw new PouchConflictError("Attached document update conflict");

      const id = _id ?? attachedDocs.length;

      const rev = (_rev ?? 0) + 1;

      const attachedDoc = { ...content, _id: id, _rev: rev };

      try {
        const response = await db.put({
          ...parentDoc,
          attachedDocs:
            id < attachedDocs.length
              ? a.replace(attachedDocs, id, attachedDoc)
              : [...attachedDocs, attachedDoc],
          lastAttachedDoc: id
        });

        assert.toBeTrue(response.ok, "Database request failed");

        return {
          id,
          parentId: response.id,
          parentRev: response.rev,
          rev
        };
      } catch (e) {
        assert.instance(e, PouchConflictError, assert.toErrorArg(e));

        return "retry";
      }
    }
  }

  public async putIfNotExists(
    doc: PutDocument
  ): Promise<PutResponse | undefined> {
    try {
      return await this.put(doc);
    } catch (e) {
      assert.instance(e, PouchConflictError, assert.toErrorArg(e));

      return undefined;
    }
  }

  public async putIfNotExistsAttached(
    parentId: string,
    doc: PutDocumentAttached
  ): Promise<PutResponseAttached | undefined> {
    try {
      return await this.putAttached(parentId, doc);
    } catch (e) {
      assert.instance(e, PouchConflictError, assert.toErrorArg(e));

      return undefined;
    }
  }

  public async query(
    conditions: Conditions,
    options: QueryOptions = {}
  ): Promise<readonly ExistingDocument[]> {
    const response = await this.rawQuery(options, {
      conditions,
      docs: true
    });

    assert.array.of(response.docs, isExistingDocument);

    return response.docs;
  }

  public async queryAttached(
    conditions: Conditions,
    parentConditions: Conditions = {},
    options: QueryOptions = {}
  ): Promise<readonly ExistingDocumentAttached[]> {
    const response = await this.rawQuery(options, {
      conditions,
      docs: true,
      parentConditions
    });

    assert.array.of(response.docs, isExistingDocumentAttached);

    return response.docs;
  }

  public async reset(callback?: ResetCallback): Promise<void> {
    const db = await this.getDb();

    await db.destroy();
    this.db = undefined;
    await this.refreshSubscription();
    await callback?.call(this);
    await this.getDb();
  }

  public async subscribe(handler: ChangesHandler): Promise<Symbol> {
    const id = Symbol("ChangesHandler");

    this.changesHandlersPool.set(id, handler);
    await this.refreshSubscription();

    return id;
  }

  public async subscribeAttached(
    handler: ChangesHandlerAttached
  ): Promise<Symbol> {
    const id = Symbol("ChangesHandlerAttached");

    this.changesHandlersAttachedPool.set(id, handler);
    await this.refreshSubscription();

    return id;
  }

  public async unsettled(
    conditions: Conditions,
    options: QueryOptions = {}
  ): Promise<number> {
    const response = await this.rawQuery(options, {
      conditions,
      unsettledCount: true
    });

    return response.unsettledCount;
  }

  public async unsettledAttached(
    conditions: Conditions,
    parentConditions: Conditions = {},
    options: QueryOptions = {}
  ): Promise<number> {
    const response = await this.rawQuery(options, {
      conditions,
      parentConditions,
      unsettledCount: true
    });

    return response.unsettledCount;
  }

  public async unsubscribe(id: Symbol): Promise<void> {
    assert.toBeTrue(this.changesHandlersPool.has(id));
    this.changesHandlersPool.delete(id);
    await this.refreshSubscription();
  }

  public async unsubscribeAttached(id: Symbol): Promise<void> {
    assert.toBeTrue(this.changesHandlersAttachedPool.has(id));
    this.changesHandlersAttachedPool.delete(id);
    await this.refreshSubscription();
  }

  /*
  |*****************************************************************************
  |* Protected
  |*****************************************************************************
  |*/

  protected changes: Changes | undefined = undefined;

  protected changesHandlersAttachedPool = new Map<
    Symbol,
    ChangesHandlerAttached
  >();

  protected changesHandlersPool = new Map<Symbol, ChangesHandler>();

  protected config: Required<Configuration>;

  protected db: PouchDBProxy | undefined = undefined;

  protected name: string;

  protected options: Required<DatabaseOptions>;

  protected pouchConfig: PouchDatabaseConfiguration;

  /**
   * Returns PouchDBProxy instance.
   *
   * @returns PouchDBProxy instance.
   */
  protected async getDb(): Promise<PouchDBProxy> {
    if (is.empty(this.db)) {
      this.db = new PouchDBProxy(this.name, this.pouchConfig);
      await this.refreshSubscription();
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
    options: QueryOptions,
    rawQueryOptions: RawQueryOptions
  ): MapReduce {
    const conds = condsToStr("doc", rawQueryOptions.conditions);

    const sortBy = options.sortBy;

    const sortDesc = options.sortDesc ?? false;

    const group1 = sortDesc ? 4 : 1;

    const group2 = sortDesc ? 3 : 2;

    const group3 = sortDesc ? 2 : 3;

    const group4 = sortDesc ? 1 : 4;

    const idParams = [
      conds,
      sortBy,
      sortDesc,
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
      mapReduce: {
        map,
        reduce
      },
      output: createFilter(conds.toOutput),
      settle: createFilter(conds.toSettle)
    };

    function createFilter(cond: string): Filter {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
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
    options: QueryOptions,
    rawQueryOptions: RawQueryOptionsAttached
  ): MapReduce {
    const conds = condsToStr("attached", rawQueryOptions.conditions);

    const parentConds = condsToStr("doc", rawQueryOptions.parentConditions);

    const sortBy = options.sortBy;

    const sortDesc = options.sortDesc ?? false;

    const group1 = sortDesc ? 4 : 1;

    const group2 = sortDesc ? 3 : 2;

    const group3 = sortDesc ? 2 : 3;

    const group4 = sortDesc ? 1 : 4;

    const idParams = [
      conds,
      parentConds,
      sortBy,
      sortDesc,
      this.options.caseSensitiveSorting
    ];

    const keyCode = fn.run((): string => {
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
      mapReduce: {
        map,
        reduce
      },
      output: createFilter(conds.toOutput, parentConds.toOutput),
      settle: createFilter(conds.toSettle, parentConds.toSettle)
    };

    function createFilter(cond1: string, cond2: string): Filter {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
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
      const defaultMigrations: PutDocument = { _id: "migrations" };

      const storedMigrations = await this.getIfExists("migrations");

      let migrations: PutDocument = storedMigrations ?? defaultMigrations;

      for (const migration of this.options.migrations)
        if (migrations[migration.id] === true) {
          // Already executed
        } else {
          {
            // eslint-disable-next-line no-await-in-loop
            await migration.callback.call(this);
          }

          {
            migrations = {
              ...migrations,
              [migration.id]: true
            };

            // eslint-disable-next-line no-await-in-loop
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
    options: QueryOptions,
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
        assert.instance(e, PouchConflictError, assert.toErrorArg(e));
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

    function getDocs(): readonly unknown[] {
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

        if (options.sortDesc ?? false) docResponses.reverse();

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
        assert.instance(e, PouchNotFoundError, assert.toErrorArg(e));
        await createDesignDocument();

        return queryAttempt();
      }
    }

    async function queryAttempt(): Promise<PouchQueryResponse> {
      return db.query(`${mapReduce.id}/default`, {
        descending: options.sortDesc,
        group: true,
        group_level: mapReduce.groupLevel,
        limit: is.not.empty(limit) ? limit + skip + 1 : undefined
      });
    }

    async function rebuildIndex(): Promise<void> {
      const doc = await db.get(`_design/${mapReduce.id}`);

      await db.put({
        ...doc,
        views: { default: mapReduce.mapReduce }
      });
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
   * Refreshes subscriptions.
   */
  protected async refreshSubscription(): Promise<void> {
    if (
      this.db &&
      this.changesHandlersPool.size + this.changesHandlersAttachedPool.size > 0
    )
      if (this.changes) {
        // Already exists
      } else
        this.changes = await this.db.changes(
          value => {
            assert.byGuard(value.doc, isExistingDocument);

            if (this.changesHandlersPool.size) {
              const doc = extractDoc(value.doc);

              for (const handler of this.changesHandlersPool.values())
                handler(doc);
            }

            if (
              this.changesHandlersAttachedPool.size &&
              is.not.empty(value.doc.lastAttachedDoc)
            ) {
              const attachedDoc = extractDocAttached(
                value.doc,
                value.doc.lastAttachedDoc
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

/*
|*******************************************************************************
|* Private
|*******************************************************************************
|*/

interface DocResponse {
  readonly doc: unknown;
  readonly key: unknown;
}

const isDocResponse: is.Guard<DocResponse> = is.factory(
  is.object.of,
  { doc: is.unknown, key: is.unknown },
  {}
);

const isDocResponses = is.factory(is.array.of, isDocResponse);

interface DocsResponse {
  readonly count: number;
  readonly docs: readonly DocResponse[];
  readonly settled: boolean;
}

const isDocsResponse: is.Guard<DocsResponse> = is.factory(
  is.object.of,
  { count: is.number, docs: isDocResponses, settled: is.boolean },
  {}
);

interface StrConds {
  readonly toEmit: string;
  readonly toOutput: string;
  readonly toSettle: string;
}

const isStoredDocumentAttached: is.Guard<StoredDocumentAttached> = is.factory(
  is.object.of,
  { _id: is.number, _rev: is.number },
  { _deleted: is.true }
);

const isStoredDocumentAttachedArray = is.factory(
  is.array.of,
  isStoredDocumentAttached
);

const isExistingDocument: is.Guard<ExistingDocument> = is.factory(
  is.object.of,
  {
    _id: is.string,
    _rev: is.string
  },
  {
    _deleted: is.true,
    attachedDocs: isStoredDocumentAttachedArray,
    lastAttachedDoc: is.number
  }
);

const isExistingDocumentAttached: is.Guard<ExistingDocumentAttached> =
  is.factory(
    is.object.of,
    {
      _id: is.number,
      _rev: is.number,
      parentDoc: isExistingDocument
    },
    {
      _deleted: is.true
    }
  );

/**
 * Joins condition strings with boolean "and" operator.
 *
 * @param conditions - Condition strings.
 * @returns Joined condition string.
 */
function and(conditions: readonly string[]): string {
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
  source: "doc" | "attached",
  conditions: Conditions
): StrConds {
  const toEmit: string[] = [];

  const toOutput: string[] = [];

  const toSettle: string[] = [];

  for (const [property, condition] of Object.entries(conditions))
    for (const [operator, value] of o.entries(condition))
      switch (operator) {
        case "dgt":
          assert.number(value);

          {
            const sign = value >= 0 ? "+" : "-";

            const abs = Math.abs(value);

            toEmit.push(`${source}.${property}`);
            toEmit.push(
              `(new Date(${source}.${property}).getTime() / 1000 > Date.now() / 1000 ${sign} ${abs} - 25 * 3600)`
            );
            toOutput.push(
              `(new Date(${source}.${property}).getTime() / 1000 > Date.now() / 1000 ${sign} ${abs})`
            );
            toSettle.push(
              `(new Date(${source}.${property}).getTime() / 1000 < Date.now() / 1000 ${sign} ${abs} - 25 * 3600)`
            );
          }

          break;

        case "dlt":
          assert.number(value);

          {
            const sign = value >= 0 ? "+" : "-";

            const abs = Math.abs(value);

            toEmit.push(`${source}.${property}`);
            toOutput.push(
              `(new Date(${source}.${property}).getTime() / 1000 < Date.now() / 1000 ${sign} ${abs})`
            );
            toSettle.push(
              `(new Date(${source}.${property}).getTime() / 1000 < Date.now() / 1000 ${sign} ${abs} - 25 * 3600)`
            );
          }

          break;

        case "eq":
          toEmit.push(`(${source}.${property} === ${escapeForJs(value)})`);

          break;

        case "gt":
          toEmit.push(`(${source}.${property} > ${escapeForJs(value)})`);

          break;

        case "gte":
          toEmit.push(`(${source}.${property} >= ${escapeForJs(value)})`);

          break;

        case "lt":
          toEmit.push(`(${source}.${property} < ${escapeForJs(value)})`);

          break;

        case "lte":
          toEmit.push(`(${source}.${property} <= ${escapeForJs(value)})`);

          break;
      }

  return {
    toEmit: and(toEmit),
    toOutput: and(toOutput),
    toSettle: and(toSettle)
  };
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
function extractDoc(rawDoc: ExistingDocument): ExistingDocument {
  return rawDoc.attachedDocs ? { ...rawDoc, attachedDocs: [] } : rawDoc;
}

/**
 * Extracts attached document.
 *
 * @param rawDoc - Document.
 * @param id - Attached document ID.
 * @returns Attached document.
 */
function extractDocAttached(
  rawDoc: ExistingDocument,
  id: number
): ExistingDocumentAttached {
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

  assert.empty(
    attachedDoc._deleted,
    () => new PouchNotFoundError("Missing attached document")
  );

  return {
    ...attachedDoc,
    parentDoc: { ...parentDoc, attachedDocs: [] }
  };
}

/**
 * Validates document.
 *
 * @param doc - Document.
 */
function validatePutDocument(doc: PutDocument): void {
  if (o.hasOwnProp("_attachments", doc))
    throw new Error("Put document contains reserved word: _attachments");

  if (o.hasOwnProp("_conflicts", doc))
    throw new Error("Put document contains reserved word: _conflicts");

  if (o.hasOwnProp("filters", doc))
    throw new Error("Put document contains reserved word: filters");

  if (o.hasOwnProp("views", doc))
    throw new Error("Put document contains reserved word: views");

  if (
    doc.attachedDocs &&
    doc.attachedDocs.some((attachedDoc, index) => attachedDoc._id !== index)
  )
    throw new Error("Invalid attached document");
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