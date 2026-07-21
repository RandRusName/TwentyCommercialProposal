import type {
  CommercialProposalAggregate,
  CommercialProposalContentModelVersion,
  CommercialProposalHeader,
} from 'src/domain/commercial-proposal-aggregate';

export type EditorItem = {
  id?: string;
  catalogItemId: string | null;
  clientKey: string;
  block: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
};

export type EditorStage = {
  id?: string;
  clientKey: string;
  title: string;
  result: string;
  duration: string;
  description: string;
};

export type EditorState = {
  proposalId: string;
  editorRevision: number;
  contentModelVersion: CommercialProposalContentModelVersion;
  status: CommercialProposalAggregate['proposal']['status'];
  number: string;
  amount: number | null;
  header: CommercialProposalHeader;
  items: EditorItem[];
  stages: EditorStage[];
};

export type EditorContextResponse = CommercialProposalAggregate & {
  status: 'success';
  opportunity: {
    id: string;
    name: string;
    amount: number | null;
    currencyCode: string | null;
  } | null;
  company: { id: string; name: string } | null;
  legacySuggestion: {
    canCreateStarterItem: boolean;
    amount: number | null;
    currencyCode: string | null;
    suggestedTitle: string | null;
  };
  isEditable: boolean;
  generationAvailability: {
    allowed: boolean;
    reason: string | null;
  };
  warnings?: Array<
    'OPPORTUNITY_CONTEXT_UNAVAILABLE' | 'COMPANY_CONTEXT_UNAVAILABLE'
  >;
};

export type EditorValidation = {
  valid: boolean;
  errors: Record<string, string>;
};

export type CatalogItemOption = {
  id: string;
  name: string;
  itemType: 'SERVICE' | 'PRODUCT' | 'LICENSE' | 'PACKAGE' | 'OTHER';
  category: string | null;
  defaultBlock: string;
  description: string | null;
  defaultUnit: string;
  defaultPrice: number;
  currencyCode: string;
  isActive: boolean;
  sortOrder: number;
  isSelectable: boolean;
  validationMessage: string | null;
};
