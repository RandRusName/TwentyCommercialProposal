import { defineObject, FieldType, RelationType } from 'twenty-sdk/define';

import {
  COMMERCIAL_PROPOSAL_FIELD_ITEMS_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_BLOCK_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_CATALOG_ITEM_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_CLIENT_KEY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_CURRENCY_CODE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_DESCRIPTION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_DISCOUNT_PERCENT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_LINE_AMOUNT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_NAME_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_POSITION_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_QUANTITY_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_UNIT_PRICE_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_FIELD_UNIT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_FIELD_PROPOSAL_ITEMS_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineObject({
  universalIdentifier: COMMERCIAL_PROPOSAL_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'commercialProposalItem',
  namePlural: 'commercialProposalItems',
  labelSingular: 'Commercial Proposal Item',
  labelPlural: 'Commercial Proposal Items',
  description: 'Commercial proposal priced work item',
  icon: 'IconListDetails',
  isSearchable: false,
  isUICreatable: false,
  isUIEditable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    COMMERCIAL_PROPOSAL_ITEM_FIELD_NAME_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_CATALOG_ITEM_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'catalogItem',
      label: 'Позиция каталога',
      description: 'Необязательный источник начальных значений строки КП',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        CATALOG_ITEM_FIELD_PROPOSAL_ITEMS_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'catalogItemId',
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_COMMERCIAL_PROPOSAL_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'commercialProposal',
      label: 'Commercial Proposal',
      description: 'Parent commercial proposal',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        COMMERCIAL_PROPOSAL_FIELD_ITEMS_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'commercialProposalId',
      },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_CLIENT_KEY_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'clientKey',
      label: 'Client key',
      description: 'Client-generated UUID used for replay-safe upsert',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_POSITION_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'Position',
      description: 'Server-normalized work item order',
      defaultValue: 1,
      isNullable: false,
      universalSettings: { decimals: 0 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_BLOCK_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'block',
      label: 'Block',
      description: 'Work block or category',
      defaultValue: "'Работы'",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_NAME_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Work item name',
      defaultValue: "''",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_DESCRIPTION_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'Optional work item description',
      isNullable: true,
      defaultValue: null,
      universalSettings: { displayedMaxRows: 4 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_QUANTITY_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Quantity',
      description: 'Work item quantity',
      defaultValue: 1,
      isNullable: false,
      universalSettings: { decimals: 4 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_UNIT_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'unit',
      label: 'Unit',
      description: 'Work item unit',
      defaultValue: "'час'",
      isNullable: false,
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_UNIT_PRICE_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'unitPrice',
      label: 'Unit price',
      description: 'Work item unit price',
      defaultValue: 0,
      isNullable: false,
      universalSettings: { decimals: 2 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_DISCOUNT_PERCENT_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'discountPercent',
      label: 'Discount percent',
      description: 'Work item discount percent',
      defaultValue: 0,
      isNullable: false,
      universalSettings: { decimals: 2 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_LINE_AMOUNT_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'lineAmount',
      label: 'Line amount',
      description: 'Server-calculated work item amount',
      defaultValue: 0,
      isNullable: false,
      universalSettings: { decimals: 2 },
    },
    {
      universalIdentifier:
        COMMERCIAL_PROPOSAL_ITEM_FIELD_CURRENCY_CODE_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'currencyCode',
      label: 'Currency code',
      description: 'Work item currency code',
      defaultValue: "''",
      isNullable: false,
    },
  ],
});
