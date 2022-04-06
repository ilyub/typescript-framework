import type { Facade, Type } from "@skylib/facades/dist/handlePromise";
import type { Rec } from "@skylib/functions/dist/types/core";
export interface Configuration {
    readonly expectedDurations: Rec<Type, number>;
}
export declare type PartialConfiguration<K extends keyof Configuration> = {
    readonly [L in K]: Configuration[L];
};
export declare const handlers: Readonly<{
    error(error: unknown): void;
}>;
/**
 * Configures plugin.
 *
 * @param config - Plugin configuration.
 */
export declare function configure(config: Partial<Configuration>): void;
/**
 * Returns plugin configuration.
 *
 * @returns Plugin configuration.
 */
export declare function getConfiguration(): Configuration;
export declare const implementation: Facade;
//# sourceMappingURL=promiseHandler.d.ts.map