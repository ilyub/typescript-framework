[Typescript framework](../index.md) / [Exports](../modules.md) / [facade-implementations/lang/dictionary/Dictionary](../modules/facade_implementations_lang_dictionary_Dictionary.md) / Dictionary

# Class: Dictionary

[facade-implementations/lang/dictionary/Dictionary](../modules/facade_implementations_lang_dictionary_Dictionary.md).Dictionary

## Implements

- `DictionaryInterface`

## Table of contents

### Constructors

- [constructor](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#constructor)

### Properties

- [\_context](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#_context)
- [count](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#count)
- [definitions](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#definitions)
- [proxified](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#proxified)
- [subsPool](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#subspool)

### Methods

- [context](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#context)
- [get](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#get)
- [has](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#has)
- [plural](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#plural)
- [pluralReduce](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#pluralreduce)
- [with](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#with)
- [configure](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#configure)
- [create](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#create)
- [getConfiguration](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md#getconfiguration)

## Constructors

### constructor

• `Protected` **new Dictionary**(`definitions`, `context?`, `count?`)

Creates class instance.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `definitions` | `Readonly`<`Partial`<`Record`<`LocaleName`, [`Definitions`](facade_implementations_lang_dictionary_Definitions.Definitions.md)\>\>\> | `undefined` | Language definitions. |
| `context?` | keyof `Context` | `undefined` | Context. |
| `count` | `number` | `1` | Count for plural form. |

## Properties

### \_context

• `Protected` **\_context**: `undefined` \| keyof `Context`

___

### count

• `Protected` **count**: `number`

___

### definitions

• `Protected` **definitions**: `Readonly`<`Partial`<`Record`<`LocaleName`, [`Definitions`](facade_implementations_lang_dictionary_Definitions.Definitions.md)\>\>\>

___

### proxified

• `Protected` **proxified**: [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

___

### subsPool

• `Protected` **subsPool**: `Map`<`NumStr`, [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>\>

## Methods

### context

▸ **context**(`context`): [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `context` | keyof `Context` |

#### Returns

[`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Implementation of

DictionaryInterface.context

___

### get

▸ **get**(`key`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `string` |

#### Returns

`string`

#### Implementation of

DictionaryInterface.get

___

### has

▸ **has**(`key`): key is Transforms

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `string` |

#### Returns

key is Transforms

#### Implementation of

DictionaryInterface.has

___

### plural

▸ **plural**(`count`): [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `count` | `number` |

#### Returns

[`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Implementation of

DictionaryInterface.plural

___

### pluralReduce

▸ `Protected` **pluralReduce**(`count`): `number`

Reduces count for plural word form.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `count` | `number` | Count. |

#### Returns

`number`

Reduced count.

___

### with

▸ **with**(`search`, `replace`): [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `search` | `string` |
| `replace` | `NumStr` |

#### Returns

[`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

#### Implementation of

DictionaryInterface.with

___

### configure

▸ `Static` **configure**<`K`\>(`config`): `void`

Configures plugin.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"localeName"`` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`PartialConfiguration`](../modules/facade_implementations_lang_dictionary_Dictionary.Dictionary.md#partialconfiguration)<`K`\> | Plugin configuration. |

#### Returns

`void`

___

### create

▸ `Static` **create**(`definitions`, `context?`, `count?`): [`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

Creates class instance.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `definitions` | `Readonly`<`Partial`<`Record`<`LocaleName`, [`Definitions`](facade_implementations_lang_dictionary_Definitions.Definitions.md)\>\>\> | Language definitions. |
| `context?` | keyof `Context` | Context. |
| `count?` | `number` | Count for plural form. |

#### Returns

[`Dictionary`](facade_implementations_lang_dictionary_Dictionary.Dictionary-1.md) & `Readonly`<`Record`<`Transforms`, `string`\>\>

Dictionary.

___

### getConfiguration

▸ `Static` **getConfiguration**(): [`Configuration`](../interfaces/facade_implementations_lang_dictionary_Dictionary.Dictionary.Configuration.md)

Returns plugin configuration.

#### Returns

[`Configuration`](../interfaces/facade_implementations_lang_dictionary_Dictionary.Dictionary.Configuration.md)

Plugin configuration.