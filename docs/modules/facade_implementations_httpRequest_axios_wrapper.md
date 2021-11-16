[Typescript framework](../index.md) / [Exports](../modules.md) / facade-implementations/httpRequest/axios-wrapper

# Module: facade-implementations/httpRequest/axios-wrapper

## Table of contents

### Interfaces

- [Configuration](../interfaces/facade_implementations_httpRequest_axios_wrapper.Configuration.md)

### Type aliases

- [PartialConfiguration](facade_implementations_httpRequest_axios_wrapper.md#partialconfiguration)

### Variables

- [implementation](facade_implementations_httpRequest_axios_wrapper.md#implementation)

### Functions

- [configure](facade_implementations_httpRequest_axios_wrapper.md#configure)
- [getConfiguration](facade_implementations_httpRequest_axios_wrapper.md#getconfiguration)

## Type aliases

### PartialConfiguration

Ƭ **PartialConfiguration**<`K`\>: { readonly [L in K]: Configuration[L] }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof [`Configuration`](../interfaces/facade_implementations_httpRequest_axios_wrapper.Configuration.md) |

## Variables

### implementation

• **implementation**: `Facade`

## Functions

### configure

▸ **configure**<`K`\>(`config`): `void`

Configures plugin.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends ``"timeout"`` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`PartialConfiguration`](facade_implementations_httpRequest_axios_wrapper.md#partialconfiguration)<`K`\> | Plugin configuration. |

#### Returns

`void`

___

### getConfiguration

▸ **getConfiguration**(): [`Configuration`](../interfaces/facade_implementations_httpRequest_axios_wrapper.Configuration.md)

Returns plugin configuration.

#### Returns

[`Configuration`](../interfaces/facade_implementations_httpRequest_axios_wrapper.Configuration.md)

Plugin configuration.