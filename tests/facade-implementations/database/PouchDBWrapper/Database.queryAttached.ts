/**
 * @jest-environment @skylib/config/src/jest-env-jsdom
 */
import type { Conditions, QueryOptions } from "@skylib/facades/dist/database";
import { database } from "@skylib/facades/dist/database";
import { datetime } from "@skylib/facades/dist/datetime";
import { uniqueId } from "@skylib/facades/dist/uniqueId";
import { wait } from "@skylib/functions/dist/helpers";
import * as testUtils from "@skylib/functions/dist/testUtils";

testUtils.installFakeTimer({ shouldAdvanceTime: true });

it("queryAttached", async () => {
  const db = database.create(uniqueId());

  await db.bulkDocs([
    { _id: "b1", attachedDocs: [{ _id: 0, _rev: 1, b: true }] },
    { _id: "b2", attachedDocs: [{ _id: 0, _rev: 1, b: false }] },
    {
      _id: "d1",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().sub(20, "minutes").toString() }
      ]
    },
    {
      _id: "d2",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().sub(10, "minutes").toString() }
      ]
    },
    {
      _id: "d3",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().add(10, "minutes").toString() }
      ]
    },
    {
      _id: "d4",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().add(20, "minutes").toString() }
      ]
    },
    { _id: "n1", attachedDocs: [{ _id: 0, _rev: 1, n: 1 }] },
    { _id: "n2", attachedDocs: [{ _id: 0, _rev: 1, n: 2 }] },
    { _id: "n3", attachedDocs: [{ _id: 0, _rev: 1, n: 3 }] },
    { _id: "s1", attachedDocs: [{ _id: 0, _rev: 1, s: "AAA" }] },
    { _id: "s2", attachedDocs: [{ _id: 0, _rev: 1, s: "bbb" }] },
    { _id: "s3", attachedDocs: [{ _id: 0, _rev: 1, s: "CCC" }] }
  ]);

  await Promise.all([
    subtest({ b: { eq: true } }, ["b1"]),
    subtest({ b: { eq: false } }, ["b2"]),
    subtest({ d: { dgt: -15 * 60 } }, ["d2", "d3", "d4"]),
    subtest({ d: { dlt: -15 * 60 } }, ["d1"]),
    subtest({ d: { dgt: 0 } }, ["d3", "d4"]),
    subtest({ d: { dlt: 0 } }, ["d1", "d2"]),
    subtest({ d: { dgt: 15 * 60 } }, ["d4"]),
    subtest({ d: { dlt: 15 * 60 } }, ["d1", "d2", "d3"]),
    subtest({ n: { gt: 2 } }, ["n3"]),
    subtest({ n: { gte: 2 } }, ["n2", "n3"]),
    subtest({ n: { lt: 2 } }, ["n1"]),
    subtest({ n: { lte: 2 } }, ["n1", "n2"]),
    subtest({ s: { eq: "bbb" } }, ["s2"])
  ]);

  async function subtest(
    conditions: Conditions,
    expected: unknown[]
  ): Promise<void> {
    const docs = await db.queryAttached(conditions);

    expect(docs.map(doc => doc.parentDoc._id)).toStrictEqual(expected);
  }
});

it("queryAttached: Combined", async () => {
  const db = database.create(uniqueId());

  await db.bulkDocs([
    {
      _id: "d1",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().sub(10, "minutes").toString() }
      ],
      d: datetime.create().sub(10, "minutes").toString()
    },
    {
      _id: "d2",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().sub(10, "minutes").toString() }
      ],
      d: datetime.create().add(10, "minutes").toString()
    },
    {
      _id: "d3",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().add(10, "minutes").toString() }
      ],
      d: datetime.create().sub(10, "minutes").toString()
    },
    {
      _id: "d4",
      attachedDocs: [
        { _id: 0, _rev: 1, d: datetime.create().add(10, "minutes").toString() }
      ],
      d: datetime.create().add(10, "minutes").toString()
    }
  ]);

  await Promise.all([
    subtest({ d: { dgt: 0 } }, { d: { dgt: 0 } }, ["d4"]),
    subtest({ d: { dgt: 0 } }, { d: { dlt: 0 } }, ["d3"]),
    subtest({ d: { dlt: 0 } }, { d: { dgt: 0 } }, ["d2"]),
    subtest({ d: { dlt: 0 } }, { d: { dlt: 0 } }, ["d1"])
  ]);

  async function subtest(
    conditions: Conditions,
    parentConditions: Conditions,
    expected: unknown[]
  ): Promise<void> {
    const docs = await db.queryAttached(conditions, parentConditions);

    expect(docs.map(doc => doc.parentDoc._id)).toStrictEqual(expected);
  }
});

it("queryAttached: Options", async () => {
  const db = database.create(uniqueId());

  await db.bulkDocs([
    { _id: "id1", attachedDocs: [{ _id: 0, _rev: 1, n: 1, s: 3 }] },
    { _id: "id2", attachedDocs: [{ _id: 0, _rev: 1, n: 1, s: 3 }] },
    { _id: "id3", attachedDocs: [{ _id: 0, _rev: 1, n: 1, s: undefined }] },
    { _id: "id4", attachedDocs: [{ _id: 0, _rev: 1, n: 1, s: 2 }] },
    { _id: "id5", attachedDocs: [{ _id: 0, _rev: 1, n: 2, s: 1 }] }
  ]);

  await Promise.all([
    subtest({ limit: 2 }, ["id1", "id2"]),
    subtest({ limit: 2, skip: 1 }, ["id2", "id3"]),
    subtest({ limit: 2, skip: 1, sortBy: "s" }, ["id4", "id1"]),
    subtest({ limit: 2, skip: 1, sortBy: "s", sortDesc: true }, ["id2", "id1"]),
    subtest({ limit: 2, skip: 1, sortDesc: true }, ["id3", "id2"]),
    subtest({ limit: 2, sortBy: "s" }, ["id3", "id4"]),
    subtest({ limit: 2, sortBy: "s", sortDesc: true }, ["id3", "id2"]),
    subtest({ limit: 2, sortDesc: true }, ["id4", "id3"]),
    subtest({ skip: 1 }, ["id2", "id3", "id4"]),
    subtest({ skip: 1, sortBy: "s" }, ["id4", "id1", "id2"]),
    subtest({ skip: 1, sortBy: "s", sortDesc: true }, ["id2", "id1", "id4"]),
    subtest({ skip: 1, sortDesc: true }, ["id3", "id2", "id1"]),
    subtest({ sortBy: "s" }, ["id3", "id4", "id1", "id2"]),
    subtest({ sortBy: "s", sortDesc: true }, ["id3", "id2", "id1", "id4"]),
    subtest({ sortDesc: true }, ["id4", "id3", "id2", "id1"])
  ]);

  async function subtest(
    options: QueryOptions,
    expected: unknown[]
  ): Promise<void> {
    const docs = await db.queryAttached({ n: { eq: 1 } }, {}, options);

    expect(docs.map(doc => doc.parentDoc._id)).toStrictEqual(expected);
  }
});

it("queryAttached: Time evolution", async () => {
  await testUtils.run(async () => {
    const db = database.create(uniqueId());

    await db.bulkDocs([
      {
        _id: "id1",
        attachedDocs: [
          { _id: 0, _rev: 1, d: datetime.create().sub(2, "days").toString() }
        ]
      },
      {
        _id: "id2",
        attachedDocs: [
          { _id: 0, _rev: 1, d: datetime.create().sub(2, "hours").toString() }
        ]
      },
      {
        _id: "id3",
        attachedDocs: [
          { _id: 0, _rev: 1, d: datetime.create().sub(1, "hour").toString() }
        ]
      },
      {
        _id: "id4",
        attachedDocs: [
          { _id: 0, _rev: 1, d: datetime.create().add(1, "hour").toString() }
        ]
      },
      {
        _id: "id5",
        attachedDocs: [
          {
            _id: 0,
            _rev: 1,
            d: datetime.create().add(2, "hours").toString()
          }
        ]
      },
      {
        _id: "id6",
        attachedDocs: [
          {
            _id: 0,
            _rev: 1,
            d: datetime.create().add(2, "days").toString()
          }
        ]
      }
    ]);

    await Promise.all([
      subtest({ d: { dgt: 0 } }, ["id4", "id5", "id6"]),
      subtest({ d: { dlt: 0 } }, ["id1", "id2", "id3"])
    ]);

    await wait(1.5 * 3600 * 1000);

    await Promise.all([
      subtest({ d: { dgt: 0 } }, ["id5", "id6"]),
      subtest({ d: { dlt: 0 } }, ["id1", "id2", "id3", "id4"])
    ]);

    await wait(1.5 * 3600 * 1000);

    await Promise.all([
      subtest({ d: { dgt: 0 } }, ["id6"]),
      subtest({ d: { dlt: 0 } }, ["id1", "id2", "id3", "id4", "id5"])
    ]);

    async function subtest(
      conditions: Conditions,
      expected: unknown[]
    ): Promise<void> {
      const docs = await db.queryAttached(conditions);

      expect(docs.map(doc => doc.parentDoc._id)).toStrictEqual(expected);
    }
  });
});

it("query: Unexpected value type", async () => {
  const db = database.create(uniqueId());

  const error = new Error("Unexpected value type: undefined");

  await expect(
    db.queryAttached({ b: { eq: undefined } })
  ).rejects.toStrictEqual(error);
});