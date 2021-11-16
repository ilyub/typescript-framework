/**
 * @jest-environment @skylib/config/src/jest-env-jsdom
 */
import type {
  Conditions,
  Database as DatabaseInterface,
  ExistingDocument,
  ExistingDocumentAttached,
  PutDocument
} from "@skylib/facades/dist/database";
import { database } from "@skylib/facades/dist/database";
import { datetime } from "@skylib/facades/dist/datetime";
import { uniqueId } from "@skylib/facades/dist/uniqueId";
import * as fn from "@skylib/functions/dist/function";
import { wait } from "@skylib/functions/dist/helpers";
import * as testUtils from "@skylib/functions/dist/testUtils";

import { Database } from "@/facade-implementations/database/PouchDBWrapper/Database";
import { PouchRetryError } from "@/facade-implementations/database/PouchDBWrapper/errors/PouchRetryError";

testUtils.installFakeTimer({ shouldAdvanceTime: true });

it("create: options.caseSensitiveSorting", async () => {
  const db1 = database.create(uniqueId());

  const db2 = database.create(uniqueId(), { caseSensitiveSorting: true });

  const docs: PutDocument[] = [
    {
      _id: "id1",
      attachedDocs: [{ _id: 0, _rev: 1, value: "eee" }],
      value: "bbb"
    },
    {
      _id: "id2",
      attachedDocs: [{ _id: 0, _rev: 1, value: "DDD" }],
      value: "AAA"
    },
    {
      _id: "id3",
      attachedDocs: [{ _id: 0, _rev: 1, value: "FFF" }],
      value: "CCC"
    }
  ];

  await Promise.all([db1.bulkDocs(docs), db2.bulkDocs(docs)]);

  await Promise.all([
    subtest(db1, "query1", ["bbb", "AAA", "CCC"]),
    subtest(db1, "query2", ["AAA", "bbb", "CCC"]),
    subtest(db2, "query1", ["bbb", "AAA", "CCC"]),
    subtest(db2, "query2", ["AAA", "CCC", "bbb"]),
    subtest(db1, "queryAttached1", ["eee", "DDD", "FFF"]),
    subtest(db1, "queryAttached2", ["DDD", "eee", "FFF"]),
    subtest(db2, "queryAttached1", ["eee", "DDD", "FFF"]),
    subtest(db2, "queryAttached2", ["DDD", "FFF", "eee"])
  ]);

  async function subtest(
    db: DatabaseInterface,
    method: "query1" | "query2" | "queryAttached1" | "queryAttached2",
    expected: string[]
  ): Promise<void> {
    const got = await fn.run(
      async (): Promise<
        ReadonlyArray<ExistingDocument | ExistingDocumentAttached>
      > => {
        switch (method) {
          case "query1":
            return db.query({});

          case "query2":
            return db.query({}, { sortBy: "value" });

          case "queryAttached1":
            return db.queryAttached({});

          case "queryAttached2":
            return db.queryAttached({}, {}, { sortBy: "value" });
        }
      }
    );

    expect(got.map(doc => doc["value"])).toStrictEqual(expected);
  }
});

it("create: options.migrations", async () => {
  const name = uniqueId();

  const id = uniqueId();

  {
    const db = database.create(name, {
      migrations: [
        {
          async callback(): Promise<void> {
            await this.put({ _id: id });
          },
          id: "migration1"
        }
      ]
    });

    await expect(db.exists(id)).resolves.toBeTrue();
  }

  {
    const callback1 = jest.fn();

    const callback2 = jest.fn();

    const db = database.create(name, {
      migrations: [
        { callback: callback1, id: "migration1" },
        { callback: callback2, id: "migration2" }
      ]
    });

    expect(callback1).not.toBeCalled();
    expect(callback2).not.toBeCalled();

    {
      await expect(db.exists(id)).resolves.toBeTrue();
      expect(callback1).not.toBeCalled();
      expect(callback2).toBeCalledTimes(1);
      expect(callback2).toBeCalledWith();
      callback2.mockClear();
    }
  }
});

it("create: options.retries = 0", async () => {
  const db = database.create(uniqueId());

  const { id } = await db.put({});

  await expect(
    Promise.all([db.putAttached(id, {}), db.putAttached(id, {})])
  ).rejects.toStrictEqual(new PouchRetryError("Failed after 0 retries"));
});

it("create: options.retries = 3", async () => {
  const db = database.create(uniqueId(), { retries: 3 });

  const { id } = await db.put({});

  const responses = await Promise.all([
    db.putAttached(id, {}),
    db.putAttached(id, {})
  ]);

  expect(responses.length).toStrictEqual(2);
  expect(responses[0]).toContainAllKeys(["id", "parentId", "parentRev", "rev"]);
  expect(responses[1]).toContainAllKeys(["id", "parentId", "parentRev", "rev"]);
});

it("create: config.reindexThreshold", async () => {
  await testUtils.run(async () => {
    const db1 = new Database(uniqueId());

    const db2 = new Database(uniqueId(), {}, { reindexThreshold: 2 });

    const docs = [
      { d: datetime.create().sub(2, "days").toString() },
      { d: datetime.create().sub(1, "hour").toString() },
      { d: datetime.create().add(1, "hour").toString() },
      { d: datetime.create().add(2, "days").toString() }
    ];

    await Promise.all([db1.bulkDocs(docs), db2.bulkDocs(docs)]);

    await Promise.all([
      subtest(db1, { d: { dgt: 0 } }, 3),
      subtest(db1, { d: { dlt: 0 } }, 3),
      subtest(db2, { d: { dgt: 0 } }, 3),
      subtest(db2, { d: { dlt: 0 } }, 3)
    ]);

    await wait(24.5 * 3600 * 1000);

    await Promise.all([
      subtest(db1, { d: { dgt: 0 } }, 2),
      subtest(db1, { d: { dlt: 0 } }, 2),
      subtest(db2, { d: { dgt: 0 } }, 3),
      subtest(db2, { d: { dlt: 0 } }, 3)
    ]);

    await wait(2 * 3600 * 1000);

    await Promise.all([
      subtest(db1, { d: { dgt: 0 } }, 1),
      subtest(db1, { d: { dlt: 0 } }, 1),
      subtest(db2, { d: { dgt: 0 } }, 1),
      subtest(db2, { d: { dlt: 0 } }, 1)
    ]);

    async function subtest(
      db: Database,
      conditions: Conditions,
      expected: number
    ): Promise<void> {
      await db.query(conditions);
      await expect(db.unsettled(conditions)).resolves.toStrictEqual(expected);
    }
  });
});

it("create: pouchConfig.revsLimit", async () => {
  await Promise.all([subtest(1), subtest(9)]);

  async function subtest(revsLimit: number): Promise<void> {
    const db = new Database(uniqueId(), {}, {}, { revs_limit: revsLimit });

    const { id: id1, rev: rev1 } = await db.put({});

    const { id: id2, rev: rev2 } = await db.put({ _id: id1, _rev: rev1 });

    const { id: id3, rev: rev3 } = await db.put({ _id: id2, _rev: rev2 });

    const rawDb = await db.getRawDb();

    const doc = await rawDb.get(id3, { revs: true });

    expect(doc._revisions).toStrictEqual({
      ids: [rev3, rev2, rev1].slice(0, revsLimit).map(rev => rev.slice(2)),
      start: 3
    });
  }
});