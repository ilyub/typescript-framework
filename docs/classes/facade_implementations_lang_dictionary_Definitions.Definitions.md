[Typescript framework](../index.md) / [Exports](../modules.md) / [facade-implementations/lang/dictionary/Definitions](../modules/facade_implementations_lang_dictionary_Definitions.md) / Definitions

# Class: Definitions

[facade-implementations/lang/dictionary/Definitions](../modules/facade_implementations_lang_dictionary_Definitions.md).Definitions

## Table of contents

### Constructors

- [constructor](facade_implementations_lang_dictionary_Definitions.Definitions.md#constructor)

### Properties

- [pluralReduce](facade_implementations_lang_dictionary_Definitions.Definitions.md#pluralreduce)
- [wordForms](facade_implementations_lang_dictionary_Definitions.Definitions.md#wordforms)
- [words](facade_implementations_lang_dictionary_Definitions.Definitions.md#words)

### Methods

- [get](facade_implementations_lang_dictionary_Definitions.Definitions.md#get)
- [has](facade_implementations_lang_dictionary_Definitions.Definitions.md#has)

## Constructors

### constructor

• **new Definitions**(`raw`)

Creates class instance.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `raw` | [`RawLanguage`](../interfaces/facade_implementations_lang_dictionary_types.RawLanguage.md) | Language definition. |

## Properties

### pluralReduce

• **pluralReduce**: [`PluralReduce`](../modules/facade_implementations_lang_dictionary_types.md#pluralreduce)

___

### wordForms

• `Protected` **wordForms**: `Readonly`<`IndexedObject`<readonly `string`[]\>\>

___

### words

• `Protected` **words**: `Readonly`<`IndexedObject`<[`Definition`](facade_implementations_lang_dictionary_Definition.Definition.md)\>\> = `{}`

## Methods

### get

▸ **get**(`key`, `context`, `forms`, `count`, `replacements`): [`WordInfo`](../interfaces/facade_implementations_lang_dictionary_types.WordInfo.md)

Gets word based on context, count, and replacements.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` | Word ID. |
| `context` | `undefined` \| keyof `Context` | Context. |
| `forms` | `string` \| readonly `string`[] | Word forms or reference to wordForms. |
| `count` | `number` | Count for plural form. |
| `replacements` | `ReadonlyMap`<`string`, `string`\> | Replacements. |

#### Returns

[`WordInfo`](../interfaces/facade_implementations_lang_dictionary_types.WordInfo.md)

Word.

___

### has

▸ **has**(`key`): key is Transforms

Checks if dictionary has word.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` | Word ID. |

#### Returns

key is Transforms

_True_ if dictionary has word, _false_ otherwise.