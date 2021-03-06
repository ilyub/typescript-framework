[Typescript framework](../index.md) / [Exports](../modules.md) / facade-implementations/lang/dictionary/core

# Module: facade-implementations/lang/dictionary/core

## Table of contents

### Interfaces

- [Configuration](../interfaces/facade_implementations_lang_dictionary_core.Configuration.md)
- [PartialConfiguration](../interfaces/facade_implementations_lang_dictionary_core.PartialConfiguration.md)
- [PluralReduce](../interfaces/facade_implementations_lang_dictionary_core.PluralReduce.md)
- [PluralReduceInternational](../interfaces/facade_implementations_lang_dictionary_core.PluralReduceInternational.md)
- [RawDefinitions](../interfaces/facade_implementations_lang_dictionary_core.RawDefinitions.md)
- [RawLanguage](../interfaces/facade_implementations_lang_dictionary_core.RawLanguage.md)
- [WordInfo](../interfaces/facade_implementations_lang_dictionary_core.WordInfo.md)

### Type Aliases

- [RawDefinition](facade_implementations_lang_dictionary_core.md#rawdefinition)
- [Rules](facade_implementations_lang_dictionary_core.md#rules)

### Variables

- [moduleConfig](facade_implementations_lang_dictionary_core.md#moduleconfig)

### Functions

- [configure](facade_implementations_lang_dictionary_core.md#configure)
- [getConfiguration](facade_implementations_lang_dictionary_core.md#getconfiguration)
- [pluralReduce](facade_implementations_lang_dictionary_core.md#pluralreduce)

## Type Aliases

### RawDefinition

Ƭ **RawDefinition**: [`RawDefinitions`](../interfaces/facade_implementations_lang_dictionary_core.RawDefinitions.md) \| `string` \| readonly [`NumStr`, [`RawDefinitions`](../interfaces/facade_implementations_lang_dictionary_core.RawDefinitions.md), `PartialRecord`<`lang.Context`, `NumStr`\>] \| readonly [`NumStr`, [`RawDefinitions`](../interfaces/facade_implementations_lang_dictionary_core.RawDefinitions.md)]

___

### Rules

Ƭ **Rules**: readonly `strings`[]

## Variables

### moduleConfig

• `Const` **moduleConfig**: `Writable`<[`Configuration`](../interfaces/facade_implementations_lang_dictionary_core.Configuration.md)\>

## Functions

### configure

▸ **configure**(`config`): `void`

Configures plugin.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`PartialConfiguration`](../interfaces/facade_implementations_lang_dictionary_core.PartialConfiguration.md) | Plugin configuration. |

#### Returns

`void`

___

### getConfiguration

▸ **getConfiguration**(): [`Configuration`](../interfaces/facade_implementations_lang_dictionary_core.Configuration.md)

Returns plugin configuration.

#### Returns

[`Configuration`](../interfaces/facade_implementations_lang_dictionary_core.Configuration.md)

Plugin configuration.

___

### pluralReduce

▸ **pluralReduce**(`count`): `number`

Reduces count for plural form.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `count` | `number` | Count. |

#### Returns

`number`

Reduced count.
