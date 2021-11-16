import type * as testUtils from "@skylib/functions/dist/testUtils";
import type { ReadonlyPartialRecord } from "@skylib/functions/dist/types/core";
import type { LocaleName } from "@skylib/functions/dist/types/locales";
import type { Definitions } from "../facade-implementations/lang/dictionary";
declare global {
    namespace jest {
        interface Matchers<R> {
            /**
             * Checks that datetime equals expected value.
             *
             * @param expected - Expected value.
             * @returns Result object.
             */
            readonly datetimeToEqual: (expected: string) => R;
        }
    }
}
/**
 * Jest reset.
 */
export declare function jestReset(): void;
export declare namespace jestReset {
    var dictionary: typeof jestResetDictionary;
    var dom: typeof jestResetDom;
}
/**
 * Jest reset.
 *
 * @param localeName - Locale name.
 * @param definitions - Language definitions.
 */
export declare function jestResetDictionary(localeName: LocaleName, definitions: ReadonlyPartialRecord<LocaleName, Definitions>): void;
/**
 * Jest reset.
 */
export declare function jestResetDom(): void;
/**
 * Jest setup.
 */
export declare function jestSetup(): void;
export declare namespace jestSetup {
    var dictionary: typeof jestSetupDictionary;
    var dom: typeof jestSetupDom;
}
/**
 * Jest setup.
 *
 * @param localeName - Locale name.
 * @param definitions - Language definitions.
 */
export declare function jestSetupDictionary(localeName: LocaleName, definitions: ReadonlyPartialRecord<LocaleName, Definitions>): void;
/**
 * Jest setup.
 */
export declare function jestSetupDom(): void;
/**
 * Checks that datetime equals expected value.
 *
 * @param got - Got value.
 * @param expected - Expected value.
 * @returns Result object.
 */
export declare function datetimeToEqual(got: unknown, expected: string): testUtils.ExpectReturnType;
//# sourceMappingURL=index.d.ts.map