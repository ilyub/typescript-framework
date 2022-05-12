import { reactiveStorage } from "@skylib/facades";
import { defineFn, o, onDemand } from "@skylib/functions";
import type { lang } from "@skylib/facades";
import type {
  LocaleName,
  NumStr,
  PartialRecord,
  Rec,
  strings
} from "@skylib/functions";

export const moduleConfig = onDemand(() =>
  reactiveStorage<Configuration>({ localeName: "en-US" })
);

export const pluralReduce = defineFn<PluralReduce, PluralReduceInternational>(
  // eslint-disable-next-line @skylib/require-jsdoc -- Ok
  (count: number): number => {
    count = Math.abs(count);

    return count === 1 ? 1 : 2;
  },
  {
    // eslint-disable-next-line @skylib/require-jsdoc -- Ok
    ru(count: number): number {
      count = Math.abs(count);

      if (count >= 10 && count <= 19) return 5;

      if (count % 10 === 1) return 1;

      if (count % 10 === 2) return 2;

      if (count % 10 === 3) return 2;

      if (count % 10 === 4) return 2;

      return 5;
    }
  }
);

export interface Configuration {
  readonly localeName: LocaleName;
}

export interface PartialConfiguration extends Partial<Configuration> {}

export interface PluralReduce {
  /**
   * Reduces count for plural form.
   *
   * @param count - Count.
   * @returns Reduced count.
   */
  (count: number): number;
}

export interface PluralReduceInternational {
  readonly ru: PluralReduce;
}

export type RawDefinition =
  | RawDefinitions
  | string
  // eslint-disable-next-line @skylib/no-multi-type-tuples -- Ok
  | readonly [NumStr, RawDefinitions, PartialRecord<lang.Context, NumStr>]
  // eslint-disable-next-line @skylib/no-multi-type-tuples -- Ok
  | readonly [NumStr, RawDefinitions];

export interface RawDefinitions {
  readonly [key: string]: RawDefinition;
}

export interface RawLanguage {
  readonly pluralReduce: PluralReduce;
  readonly wordForms: Rec<string, strings>;
  readonly words: Rec<lang.Word, RawDefinition>;
}

export type Rules = readonly strings[];

export interface WordInfo {
  readonly context?: lang.Context;
  readonly count: number;
  readonly forms: strings;
  readonly replacements: ReadonlyMap<string, string>;
  readonly value: string;
}

/**
 * Configures plugin.
 *
 * @param config - Plugin configuration.
 */
export function configure(config: PartialConfiguration): void {
  o.assign(moduleConfig, config);
}

/**
 * Returns plugin configuration.
 *
 * @returns Plugin configuration.
 */
export function getConfiguration(): Configuration {
  return moduleConfig;
}