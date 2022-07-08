import type * as testUtils from "@skylib/functions/dist/test-utils";
import $ from "jquery";
import { DateTime } from "../facade-implementations/datetime/date-fns-wrapper/DateTime";
// eslint-disable-next-line no-warning-comments -- Wait for @skylib/functions update
// fixme
import type { Result } from "@skylib/functions/dist/test-utils/expect.internal";
import { assert } from "@skylib/functions";
import { progressReporter } from "@skylib/facades";

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Checks that datetime equals expected value.
       *
       * @param expected - Expected value.
       * @returns Result object.
       */
      readonly datetimeToBe: (expected: string) => R;
      /**
       * Checks that progress equals expected value.
       *
       * @param expected - Expected value.
       * @returns Result object.
       */
      readonly progressToBe: (expected: number) => R;
    }
  }
}

export const datetimeToBe: testUtils.ExpectFromMatcher<"datetimeToBe"> = (
  got: unknown,
  expected: string
): Result => {
  assert.instanceOf(got, DateTime, "Expecting DateTime instance");

  return got.toTime() === new Date(expected).getTime()
    ? {
        message: (): string => `Expected date not to be "${expected}"`,
        pass: true
      }
    : {
        message: (): string =>
          `Expected date ("${got.toString()}") to be "${expected}"`,
        pass: false
      };
};

export const progressToBe: testUtils.ExpectFromMatcher<"progressToBe"> = (
  got: unknown,
  expected: number
): Result => {
  assert.string(got, "Expecting string");

  const gotProgress = progressReporter.getProgress();

  const classOptions =
    gotProgress === 0
      ? new Set([undefined, ""])
      : new Set(["progress-bar-active"]);

  const styleOptions =
    gotProgress === 0
      ? new Set([undefined, ""])
      : new Set([`width: ${100 * progressReporter.getProgress()}%;`]);

  return gotProgress === expected &&
    classOptions.has($(got).attr("class")) &&
    styleOptions.has($(got).attr("style"))
    ? {
        message: (): string => `Expected progress not to be ${expected}`,
        pass: true
      }
    : {
        message: (): string =>
          `Expected progress (${gotProgress}) to be ${expected}`,
        pass: false
      };
};

export const matchers = { datetimeToBe, progressToBe } as const;
