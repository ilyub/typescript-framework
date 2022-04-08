import type {
  Engine as EngineInterface,
  Facade
} from "@skylib/facades/dist/inlineSearch";

export abstract class Engine<T extends object, I>
  implements EngineInterface<T>
{
  /**
   * Creates class instance.
   *
   * @param idField - ID field.
   * @param fields - Searchable fields.
   * @param items - Items.
   */
  public constructor(
    idField: string & keyof T,
    fields: ReadonlyArray<string & keyof T>,
    items: readonly T[]
  ) {
    this.idField = idField;
    this.items = items;
    this.index = this.buildIndex(idField, fields, items);
  }

  public abstract search(query: string): readonly T[];

  protected idField: string & keyof T;

  protected index: I;

  protected items: readonly T[];

  /**
   * Builds index.
   *
   * @param idField - ID field.
   * @param fields - Searchable fields.
   * @param items - Items.
   * @returns Index.
   */
  protected abstract buildIndex(
    idField: string & keyof T,
    fields: ReadonlyArray<string & keyof T>,
    items: readonly T[]
  ): I;
}

export type Constructor = new <T extends object>(
  idField: string & keyof T,
  fields: ReadonlyArray<string & keyof T>,
  items: readonly T[]
) => EngineInterface<T>;

/**
 * Creates search engine.
 *
 * @param ctor - Search engine constructor.
 * @returns Search engine.
 */
export function createImplementation(ctor: Constructor): Facade {
  return {
    create<T extends object>(
      idField: string & keyof T,
      fields: ReadonlyArray<string & keyof T>,
      items: readonly T[]
    ): EngineInterface<T> {
      return new ctor<T>(idField, fields, items);
    }
  };
}
