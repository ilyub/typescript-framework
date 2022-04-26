import { a, assert, fn, is, o, regexp } from "@skylib/functions";
import type { Definitions } from "./Definitions";
import type { RawDefinition, WordInfo } from "./types";
import type { lang } from "@skylib/facades";
import type { IndexedObject, NumStr, strings } from "@skylib/functions";

export class Definition {
  /**
   * Creates class instance.
   *
   * @param raw - Raw definition.
   * @param id - ID.
   */
  public constructor(raw: RawDefinition, id: NumStr) {
    this.id = id;

    switch (typeof raw) {
      case "object": {
        const [primary, subs, contexts] = is.array(raw)
          ? raw
          : [undefined, raw, undefined];

        this.contexts = contexts ?? {};

        this.subs = o.map(subs, (value, key) => new Definition(value, key));

        this.sub = fn.run(() => {
          const result = is.not.empty(primary)
            ? this.subs[primary]
            : o.values(this.subs)[0];

          assert.not.empty(result, `Invalid primary reference: ${id}`);

          return result;
        });

        this.value = this.sub.value;

        break;
      }

      case "string":
        this.value = raw;

        break;
    }

    const reRef = /<([^\s.:<>{}]+):([^\s.:<>{}]+)>/u;

    const reRefDependent = /<([^\s.:<>{}]+)>/u;

    const reRefSecondary = /<([^\s.:<>{}]+)\.([^\s.:<>{}]+)>/u;

    const reVal = /@([^\s.:<>{}]+)/u;

    const reWord = /\{([^\s.:<>{}]+)\}/u;

    const reWordSecondary = /\{([^\s.:<>{}]+)\.([^\s.:<>{}]+)\}/u;

    this.rulesRef = regexp.matchAll(this.value, reRef);
    this.rulesRefDependent = regexp.matchAll(this.value, reRefDependent);
    this.rulesRefSecondary = regexp.matchAll(this.value, reRefSecondary);
    this.rulesVal = regexp.matchAll(this.value, reVal);
    this.rulesWord = regexp.matchAll(this.value, reWord);
    this.rulesWordSecondary = regexp.matchAll(this.value, reWordSecondary);
  }

  /**
   * Returns word based on context, word forms, and count.
   * Applies replacements.
   *
   * @param owner - Parent object.
   * @param context - Context.
   * @param forms - Word form.
   * @param count - Count for plural form.
   * @param replacements - Replacements.
   * @returns Word.
   */
  public get(
    owner: Definitions,
    context: lang.Context | undefined,
    forms: strings,
    count: number,
    replacements: ReadonlyMap<string, string>
  ): WordInfo {
    if (context) {
      const ref = this.contexts[context];

      if (is.not.empty(ref)) {
        const definition = this.subs[ref];

        assert.not.empty(
          definition,
          `Invalid context reference: ${this.id}.${context}`
        );

        return definition.get(owner, context, forms, count, replacements);
      }
    }

    for (const form of forms) {
      const definition = this.subs[form];

      if (definition)
        return definition.get(owner, context, [form], count, replacements);
    }

    // eslint-disable-next-line no-warning-comments -- Postponed
    // fixme: Compare to dictionary's count
    if (count === 1) {
      // Plural form not needed
    } else {
      const definition = this.subs[count];

      if (definition)
        return definition.get(owner, context, forms, count, replacements);
    }

    if (this.sub)
      return this.sub.get(owner, context, forms, count, replacements);

    let word: WordInfo = o.removeUndefinedKeys({
      context,
      count,
      forms,
      replacements,
      value: this.value
    });

    word = this.applyRulesRef(word, owner);
    word = this.applyRulesRefDependent(word, owner);
    word = this.applyRulesRefSecondary(word, owner);
    word = this.applyRulesVal(word);
    word = this.applyRulesWord(word, owner);
    word = this.applyRulesWordSecondary(word, owner);

    return word;
  }

  protected readonly contexts: IndexedObject<NumStr> = {};

  protected readonly id: NumStr;

  protected readonly rulesRef: Definition.stringsArray;

  protected readonly rulesRefDependent: Definition.stringsArray;

  protected readonly rulesRefSecondary: Definition.stringsArray;

  protected readonly rulesVal: Definition.stringsArray;

  protected readonly rulesWord: Definition.stringsArray;

  protected readonly rulesWordSecondary: Definition.stringsArray;

  protected readonly sub: Definition | undefined = undefined;

  protected readonly subs: IndexedObject<Definition> = {};

  protected readonly value: string;

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @param owner - Parent object.
   * @returns Modified word.
   */
  protected applyRulesRef(word: WordInfo, owner: Definitions): WordInfo {
    for (const rule of this.rulesRef) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const rule2 = a.get(rule, 2).toLowerCase();

      const key = word.replacements.get(rule1);

      assert.string(key, `Missing replacement: ${this.id}.${rule1}`);

      const word2 = owner.get(
        key,
        word.context,
        rule2,
        word.count,
        word.replacements
      );

      word = {
        ...word,
        forms: word2.forms,
        value: word.value.replace(rule0, word2.value)
      };
    }

    return word;
  }

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @param owner - Parent object.
   * @returns Modified word.
   */
  protected applyRulesRefDependent(
    word: WordInfo,
    owner: Definitions
  ): WordInfo {
    for (const rule of this.rulesRefDependent) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const key = word.replacements.get(rule1);

      assert.string(key, `Missing replacement: ${this.id}.${rule1}`);

      const word2 = owner.get(
        key,
        word.context,
        word.forms,
        word.count,
        word.replacements
      );

      word = { ...word, value: word.value.replace(rule0, word2.value) };
    }

    return word;
  }

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @param owner - Parent object.
   * @returns Modified word.
   */
  protected applyRulesRefSecondary(
    word: WordInfo,
    owner: Definitions
  ): WordInfo {
    for (const rule of this.rulesRefSecondary) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const rule2 = a.get(rule, 2).toLowerCase();

      const key = word.replacements.get(rule1);

      assert.string(key, `Missing replacement: ${this.id}.${rule1}`);

      const word2 = owner.get(key, word.context, rule2, 1, word.replacements);

      word = { ...word, value: word.value.replace(rule0, word2.value) };
    }

    return word;
  }

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @returns Modified word.
   */
  protected applyRulesVal(word: WordInfo): WordInfo {
    for (const rule of this.rulesVal) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const value = word.replacements.get(rule1);

      assert.string(value, `Missing replacement: ${this.id}.${rule1}`);
      word = { ...word, value: word.value.replace(rule0, value) };
    }

    return word;
  }

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @param owner - Parent object.
   * @returns Modified word.
   */
  protected applyRulesWord(word: WordInfo, owner: Definitions): WordInfo {
    for (const rule of this.rulesWord) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const word2 = owner.get(
        rule1,
        word.context,
        word.forms,
        word.count,
        word.replacements
      );

      word = { ...word, value: word.value.replace(rule0, word2.value) };
    }

    return word;
  }

  /**
   * Applies rules to the word.
   *
   * @param word - Word.
   * @param owner - Parent object.
   * @returns Modified word.
   */
  protected applyRulesWordSecondary(
    word: WordInfo,
    owner: Definitions
  ): WordInfo {
    for (const rule of this.rulesWordSecondary) {
      const rule0 = a.get(rule, 0);

      const rule1 = a.get(rule, 1);

      const rule2 = a.get(rule, 2).toLowerCase();

      const word2 = owner.get(rule1, word.context, rule2, 1, word.replacements);

      word = { ...word, value: word.value.replace(rule0, word2.value) };
    }

    return word;
  }
}

export namespace Definition {
  export type stringsArray = readonly strings[];
}
