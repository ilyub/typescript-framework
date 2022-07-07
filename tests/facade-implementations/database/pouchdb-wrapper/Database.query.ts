import { implementations } from "@";
import { database, datetime, handlePromise, uniqueId } from "@skylib/facades";
import { a, typedef, wait } from "@skylib/functions";
import * as testUtils from "@skylib/functions/dist/test-utils";
import type { unknowns } from "@skylib/functions";

const pouchdb = new implementations.database.PouchWrapper();

testUtils.installFakeTimer({ shouldAdvanceTime: true });

interface StoredAttachedDocument extends database.BaseStoredAttachedDocument {
  readonly [K: string]: unknown;
}

// eslint-disable-next-line no-warning-comments -- Wait for @skylib/facades update
// fixme
type StoredAttachedDocuments = readonly StoredAttachedDocument[];

test("query: Unexpected value type", async () => {
  const db = pouchdb.create(uniqueId());

  const error = new Error("Unexpected value type: object");

  await expect(db.query({ x: { eq: null } })).rejects.toStrictEqual(error);
});

test("query: boolean", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([{ x: true }, { x: false }, {}]);

  await expect(
    Promise.all([
      query({ x: { isSet: true } }),
      query({ x: { isSet: false } }),
      query({ x: { eq: true } }),
      query({ x: { eq: false } }),
      query({ x: { neq: true } }),
      query({ x: { neq: false } })
    ])
  ).resolves.toStrictEqual([
    [false, true],
    [undefined],
    [true],
    [false],
    [false],
    [true]
  ]);

  async function query(conditions: database.Conditions): Promise<unknowns> {
    const result = await db.query(conditions);

    return a.sort(result.map(doc => doc["x"]));
  }
});

test("query: conditions", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([
    { x: 1, y: "a" },
    { x: 2, y: "b" },
    { x: 3, y: "c" }
  ]);

  await expect(
    Promise.all([
      query({ x: { gt: 1 }, y: { lt: "c" } }),
      query([{ x: { gt: 1 } }, { x: { lt: 3 } }]),
      query([{ x: { gt: 1 } }, { x: { gt: 2 } }]),
      query([{ x: { gt: 2 } }, { x: { gt: 1 } }])
    ])
  ).resolves.toStrictEqual([[2], [2], [3], [3]]);

  async function query(conditions: database.Conditions): Promise<unknowns> {
    const result = await db.query(conditions);

    return a.sort(result.map(doc => doc["x"]));
  }
});

test("query: datetime + condition type", async () => {
  expect.hasAssertions();

  await testUtils.run(async () => {
    testUtils.clock.setSystemTime(datetime.create("2001-02-15 12:30").toDate());

    const db = pouchdb.create(uniqueId());

    await db.bulkDocs([
      { d: "2001-02-15 12:30" },
      { d: "2001-02-16 00:00" },
      { d: "2001-02-15 13:00" },
      { d: "2001-03-01 00:00" },
      { d: "2001-02-18 00:00" },
      { d: "2001-02-15 00:00" },
      { d: "2001-02-15 12:00" },
      { d: "2001-02-01 00:00" },
      { d: "2001-02-11 00:00" }
    ]);

    await expect(
      Promise.all([
        query({ d: { dateEq: ["now"] } }),
        query({ d: { dateEq: ["endOfDay"] } }),
        query({ d: { dateEq: ["endOfHour"] } }),
        query({ d: { dateEq: ["endOfMonth"] } }),
        query({ d: { dateEq: ["endOfWeek"] } }),
        query({ d: { dateEq: ["startOfDay"] } }),
        query({ d: { dateEq: ["startOfHour"] } }),
        query({ d: { dateEq: ["startOfMonth"] } }),
        query({ d: { dateEq: ["startOfWeek"] } })
      ])
    ).resolves.toStrictEqual([
      ["2001-02-15 12:30"],
      ["2001-02-16 00:00"],
      ["2001-02-15 13:00"],
      ["2001-03-01 00:00"],
      ["2001-02-18 00:00"],
      ["2001-02-15 00:00"],
      ["2001-02-15 12:00"],
      ["2001-02-01 00:00"],
      ["2001-02-11 00:00"]
    ]);

    async function query(conditions: database.Conditions): Promise<unknowns> {
      const result = await db.query(conditions);

      return a.sort(result.map(doc => doc["d"]));
    }
  });
});

test("query: datetime + condition unit", async () => {
  expect.hasAssertions();

  await testUtils.run(async () => {
    testUtils.clock.setSystemTime(datetime.create("2001-02-15 12:30").toDate());

    const db = pouchdb.create(uniqueId());

    await db.bulkDocs([
      { d: "2001-02-15 12:31" },
      { d: "2001-02-15 12:28" },
      { d: "2001-02-15 13:30" },
      { d: "2001-02-15 10:30" },
      { d: "2001-02-16 12:30" },
      { d: "2001-02-13 12:30" }
    ]);

    await expect(
      Promise.all([
        query({ d: { dateEq: ["now", "+", 1, "minute"] } }),
        query({ d: { dateEq: ["now", "-", 2, "minutes"] } }),
        query({ d: { dateEq: ["now", "+", 1, "hour"] } }),
        query({ d: { dateEq: ["now", "-", 2, "hours"] } }),
        query({ d: { dateEq: ["now", "+", 1, "day"] } }),
        query({ d: { dateEq: ["now", "-", 2, "days"] } })
      ])
    ).resolves.toStrictEqual([
      ["2001-02-15 12:31"],
      ["2001-02-15 12:28"],
      ["2001-02-15 13:30"],
      ["2001-02-15 10:30"],
      ["2001-02-16 12:30"],
      ["2001-02-13 12:30"]
    ]);

    async function query(conditions: database.Conditions): Promise<unknowns> {
      const result = await db.query(conditions);

      return a.sort(result.map(doc => doc["d"]));
    }
  });
});

test("query: datetime + operator", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([
    { d: "2001-02-15 11:30" },
    { d: "2001-02-15 12:30" },
    { d: "2001-02-15 13:30" }
  ]);

  await expect(
    Promise.all([
      query({ d: { dateEq: "2001-02-15 12:30" } }),
      query({ d: { dateNeq: "2001-02-15 12:30" } }),
      query({ d: { dateGt: "2001-02-15 12:30" } }),
      query({ d: { dateGte: "2001-02-15 12:30" } }),
      query({ d: { dateLt: "2001-02-15 12:30" } }),
      query({ d: { dateLte: "2001-02-15 12:30" } })
    ])
  ).resolves.toStrictEqual([
    ["2001-02-15 12:30"],
    ["2001-02-15 11:30", "2001-02-15 13:30"],
    ["2001-02-15 13:30"],
    ["2001-02-15 12:30", "2001-02-15 13:30"],
    ["2001-02-15 11:30"],
    ["2001-02-15 11:30", "2001-02-15 12:30"]
  ]);

  async function query(conditions: database.Conditions): Promise<unknowns> {
    const result = await db.query(conditions);

    return a.sort(result.map(doc => doc["d"]));
  }
});

test("query: number", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([{ x: 1 }, { x: 2 }, { x: 3 }, {}]);

  await expect(
    Promise.all([
      query({ x: { isSet: true } }),
      query({ x: { isSet: false } }),
      query({ x: { eq: 2 } }),
      query({ x: { neq: 2 } }),
      query({ x: { gt: 2 } }),
      query({ x: { gte: 2 } }),
      query({ x: { lt: 2 } }),
      query({ x: { lte: 2 } })
    ])
  ).resolves.toStrictEqual([
    [1, 2, 3],
    [undefined],
    [2],
    [1, 3],
    [3],
    [2, 3],
    [1],
    [1, 2]
  ]);

  async function query(conditions: database.Conditions): Promise<unknowns> {
    const result = await db.query(conditions);

    return a.sort(result.map(doc => doc["x"]));
  }
});

test("query: options", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([
    { x: 1, y: "d" },
    { x: 2, y: "c" },
    { x: 3, y: "b" },
    { x: 4, y: "a" },
    {}
  ]);

  await expect(
    Promise.all([
      query({ limit: 2, sortBy: "x" }),
      query({
        limit: 2,
        skip: 1,
        sortBy: "x"
      }),
      query({ skip: 1, sortBy: "x" }),
      query({ sortBy: "x" }),
      query({ sortBy: "y" }),
      query({ descending: true, sortBy: "x" }),
      query({ descending: true, sortBy: "y" })
    ])
  ).resolves.toStrictEqual([
    [1, 2],
    [2, 3],
    [2, 3, 4, undefined],
    [1, 2, 3, 4, undefined],
    [4, 3, 2, 1, undefined],
    [4, 3, 2, 1, undefined],
    [1, 2, 3, 4, undefined]
  ]);

  async function query(options: database.QueryOptions): Promise<unknowns> {
    const result = await db.query({}, options);

    return result.map(doc => doc["x"]);
  }
});

test("query: string", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([{ x: "a" }, { x: "b" }, { x: "c" }, {}]);

  await expect(
    Promise.all([
      query({ x: { isSet: true } }),
      query({ x: { isSet: false } }),
      query({ x: { eq: "b" } }),
      query({ x: { neq: "b" } }),
      query({ x: { gt: "b" } }),
      query({ x: { gte: "b" } }),
      query({ x: { lt: "b" } }),
      query({ x: { lte: "b" } })
    ])
  ).resolves.toStrictEqual([
    ["a", "b", "c"],
    [undefined],
    ["b"],
    ["a", "c"],
    ["c"],
    ["b", "c"],
    ["a"],
    ["a", "b"]
  ]);

  async function query(conditions: database.Conditions): Promise<unknowns> {
    const result = await db.query(conditions);

    return a.sort(result.map(doc => doc["x"]));
  }
});

test("queryAttached", async () => {
  const db = pouchdb.create(uniqueId());

  const id1 = uniqueId();

  const id2 = uniqueId();

  const docs = [
    { _id: id1, x: "a" },
    { _id: id2, x: "b" }
  ] as const;

  const attachedDocs = [
    { parentDoc: { _id: id1, _rev: uniqueId() }, y: "a" },
    { parentDoc: { _id: id1, _rev: uniqueId() }, y: "b" },
    { parentDoc: { _id: id2, _rev: uniqueId() }, y: "a" },
    { parentDoc: { _id: id2, _rev: uniqueId() }, y: "b" }
  ] as const;

  const conds0 = {} as const;

  const condsX = { x: { eq: "a" } } as const;

  const condsY = { y: { eq: "a" } } as const;

  await db.bulkDocs(docs);
  await db.bulkDocsAttached(attachedDocs);
  await expect(query()).resolves.toStrictEqual(["a", "a", "b", "b"]);
  await expect(query(conds0, condsX)).resolves.toStrictEqual(["a", "b"]);
  await expect(query(condsY, conds0)).resolves.toStrictEqual(["a", "a"]);
  await expect(query(condsY, condsX)).resolves.toStrictEqual(["a"]);

  async function query(
    conditions?: database.Conditions,
    parentConditions?: database.Conditions
  ): Promise<unknowns> {
    const result = await db.queryAttached(conditions, parentConditions);

    return a.sort(result.map(doc => doc["y"]));
  }
});

test("queryAttached: options", async () => {
  const db = pouchdb.create(uniqueId());

  await db.bulkDocs([
    {
      attachedDocs: typedef<StoredAttachedDocuments>([
        {
          _id: 0,
          _rev: 1,
          x: 1,
          y: "d"
        },
        {
          _id: 1,
          _rev: 1,
          x: 2,
          y: "c"
        }
      ])
    },
    {
      attachedDocs: typedef<StoredAttachedDocuments>([
        {
          _id: 0,
          _rev: 1,
          x: 3,
          y: "b"
        },
        {
          _id: 1,
          _rev: 1,
          x: 4,
          y: "a"
        }
      ])
    },
    { attachedDocs: typedef<StoredAttachedDocuments>([{ _id: 0, _rev: 1 }]) }
  ]);

  await expect(
    Promise.all([
      query({ limit: 2, sortBy: "x" }),
      query({
        limit: 2,
        skip: 1,
        sortBy: "x"
      }),
      query({ skip: 1, sortBy: "x" }),
      query({ sortBy: "x" }),
      query({ sortBy: "y" }),
      query({ descending: true, sortBy: "x" }),
      query({ descending: true, sortBy: "y" })
    ])
  ).resolves.toStrictEqual([
    [1, 2],
    [2, 3],
    [2, 3, 4, undefined],
    [1, 2, 3, 4, undefined],
    [4, 3, 2, 1, undefined],
    [4, 3, 2, 1, undefined],
    [1, 2, 3, 4, undefined]
  ]);

  async function query(options: database.QueryOptions): Promise<unknowns> {
    const result = await db.queryAttached({}, {}, options);

    return result.map(doc => doc["x"]);
  }
});

test("reactiveQuery", async () => {
  expect.hasAssertions();

  await testUtils.run(async () => {
    const db = database.create(uniqueId());

    const config: database.ReactiveConfig = {
      conditions: { type: { eq: "a" } },
      update: doc => doc["type"] === "a"
    };

    const result = db.reactiveQuery(config);

    expect(result.loaded).toBeFalse();
    await handlePromise.runAll();
    expect(result.loaded).toBeTrue();
    expect(result.value).toStrictEqual([]);

    const { id, rev } = await db.put({ type: "a" });

    const expected = [
      {
        _id: id,
        _rev: rev,
        type: "a"
      }
    ] as const;

    await wait(1000);
    expect(result.value).toStrictEqual(expected);
  });
});

test("reactiveQueryAttached", async () => {
  expect.hasAssertions();

  await testUtils.run(async () => {
    const db = database.create(uniqueId());

    const id = uniqueId();

    await db.put({ _id: id });

    const config: database.ReactiveConfigAttached = {
      conditions: { type: { eq: "a" } },
      update: doc => doc["type"] === "a"
    };

    const result = db.reactiveQueryAttached(config);

    expect(result.loaded).toBeFalse();
    await handlePromise.runAll();
    expect(result.loaded).toBeTrue();
    expect(result.value).toStrictEqual([]);

    const { parentRev: rev } = await db.putAttached(id, { type: "a" });

    const expected = [
      {
        _id: 0,
        _rev: 1,
        parentDoc: {
          _id: id,
          _rev: rev,
          attachedDocs: [],
          lastAttachedDocs: [0]
        },
        type: "a"
      }
    ] as const;

    await wait(1000);
    expect(result.value).toStrictEqual(expected);
  });
});
