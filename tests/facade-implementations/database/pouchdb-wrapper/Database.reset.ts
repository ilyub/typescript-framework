/* eslint jest/max-expects: [warn, { max: 2 }] -- Ok */

import { implementations } from "@";
import { uniqueId } from "@skylib/facades";

const pouchdb = new implementations.database.PouchWrapper();

test("reset", async () => {
  const db = pouchdb.create(uniqueId());

  const id = uniqueId();

  await db.put({ _id: id });
  await expect(db.exists(id)).resolves.toBeTrue();
  await db.reset();
  await expect(db.exists(id)).resolves.toBeFalse();
});

test("reset: callback", async () => {
  const db = pouchdb.create(uniqueId());

  const callback = jest.fn();

  expect(callback).mockCallsToBe();
  await db.reset(callback);
  expect(callback).mockCallsToBe([]);
});
