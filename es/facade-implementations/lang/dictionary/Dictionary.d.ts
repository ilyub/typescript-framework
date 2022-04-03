import type { Context, Dictionary as DictionaryInterface, Facade, Transforms, Word } from "@skylib/facades/es/lang";
import type { LocaleName } from "@skylib/functions/es/types/configurable";
import type { NumStr, TypedObject } from "@skylib/functions/es/types/core";
import type { Definitions } from ".";
export declare namespace Dictionary {
    interface Configuration {
        readonly localeName: LocaleName;
    }
}
export declare class Dictionary implements DictionaryInterface {
    /**
     * Configures plugin.
     *
     * @param config - Plugin configuration.
     */
    static configure(config: Partial<Dictionary.Configuration>): void;
    /**
     * Creates class instance.
     *
     * @param definitions - Language definitions.
     * @param context - Context.
     * @param count - Count for plural form.
     * @returns Dictionary.
     */
    static create(definitions: TypedObject<LocaleName, Definitions>, context?: Context, count?: number): Facade;
    /**
     * Returns plugin configuration.
     *
     * @returns Plugin configuration.
     */
    static getConfiguration(): Dictionary.Configuration;
    context(context: Context): Facade;
    get(key: string): string;
    has(key: string): key is Transforms<Word>;
    plural(count: number): Facade;
    with(search: string, replace: NumStr): Facade;
    protected _context: Context | undefined;
    protected count: number;
    protected definitions: TypedObject<LocaleName, Definitions>;
    protected proxified: Facade;
    protected subsPool: Map<NumStr, Facade>;
    /**
     * Creates class instance.
     *
     * @param definitions - Language definitions.
     * @param context - Context.
     * @param count - Count for plural form.
     */
    protected constructor(definitions: TypedObject<LocaleName, Definitions>, context?: Context, count?: number);
    /**
     * Reduces count for plural word form.
     *
     * @param count - Count.
     * @returns Reduced count.
     */
    protected pluralReduce(count: number): number;
}
//# sourceMappingURL=Dictionary.d.ts.map