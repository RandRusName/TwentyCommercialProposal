import { describe, expect, it } from 'vitest';
import {
  PageLayoutTabLayoutMode,
  PageLayoutType,
  ViewOpenRecordIn,
} from 'twenty-sdk/define';

import * as universalIdentifiers from 'src/constants/universal-identifiers';
import openCommercialProposalRecord from 'src/front-components/open-commercial-proposal-record.front-component';
import commercialProposalFinalNumberKeyIndex from 'src/indexes/commercial-proposal-final-number-key.index';
import commercialProposalObject from 'src/objects/commercial-proposal.object';
import commercialProposalRecordPage from 'src/page-layouts/commercial-proposal-record-page.page-layout';
import commercialProposalsView from 'src/views/commercial-proposals.view';

type ConfigResult<T> = { config: T };

describe('commercial proposal business UX metadata', () => {
  it('creates new records with aggregate v2 defaults and locks server-owned fields', () => {
    const metadata = (commercialProposalObject as unknown as ConfigResult<{
      fields: Array<Record<string, unknown>>;
    }>).config;
    const fields = Object.fromEntries(
      metadata.fields.map((field) => [field.name, field]),
    );

    expect(fields.contentModelVersion).toMatchObject({
      defaultValue: "'AGGREGATE_V2'",
      isUIEditable: false,
    });
    expect(fields.finalNumberKey).toMatchObject({
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    });
    for (const fieldName of [
      'number',
      'status',
      'version',
      'editorRevision',
      'lastEditorOperationId',
      'payloadSnapshot',
      'resultMetadata',
      'amount',
      'generatedAt',
      'files',
      'idempotencyKey',
      'lastError',
    ]) {
      expect(fields[fieldName]).toMatchObject({ isUIEditable: false });
    }
  });

  it('backs the nullable final number key with an app-owned unique index', () => {
    const finalNumberIndex = (commercialProposalFinalNumberKeyIndex as unknown as ConfigResult<{
      isUnique: boolean;
      fields: Array<{ fieldUniversalIdentifier: string }>;
    }>).config;

    expect(finalNumberIndex).toMatchObject({
      isUnique: true,
      fields: [{
        fieldUniversalIdentifier:
          universalIdentifiers.COMMERCIAL_PROPOSAL_FIELD_FINAL_NUMBER_KEY_UNIVERSAL_IDENTIFIER,
      }],
    });
  });

  it('defines a CommercialProposal record page without a generic fields widget', () => {
    const layout = (commercialProposalRecordPage as unknown as ConfigResult<{
      type: string;
      objectUniversalIdentifier: string;
      tabs: Array<{
        universalIdentifier: string;
        title: string;
        position: number;
        layoutMode: string;
        widgets?: Array<{
          type: string;
          gridPosition?: Record<string, number>;
          configuration: Record<string, unknown>;
        }>;
      }>;
    }>).config;

    expect(layout.type).toBe(PageLayoutType.RECORD_PAGE);
    expect(layout.objectUniversalIdentifier).toBe(
      universalIdentifiers.COMMERCIAL_PROPOSAL_OBJECT_UNIVERSAL_IDENTIFIER,
    );
    expect(layout.tabs).toHaveLength(1);
    expect(
      [...layout.tabs].sort((left, right) => left.position - right.position)[0],
    ).toMatchObject({
      universalIdentifier:
        universalIdentifiers.COMMERCIAL_PROPOSAL_RECORD_PAGE_HOME_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Коммерческое предложение',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
    });
    expect(layout.tabs.flatMap((tab) => tab.widgets ?? []).map((widget) => widget.type))
      .toEqual(['FRONT_COMPONENT']);
    expect(layout.tabs[0]?.widgets?.[0]?.gridPosition).toEqual({
      row: 0,
      column: 0,
      rowSpan: 12,
      columnSpan: 12,
    });
    expect(layout.tabs.flatMap((tab) => tab.widgets ?? []).some((widget) => widget.type === 'FIELDS'))
      .toBe(false);
  });

  it('opens records in the central record page and keeps new identifiers unique', () => {
    const view = (commercialProposalsView as unknown as ConfigResult<{
      openRecordIn: string;
    }>).config;
    const navigationComponent = (openCommercialProposalRecord as unknown as ConfigResult<{
      isHeadless: boolean;
    }>).config;
    const recordPageIdentifiers = Object.entries(universalIdentifiers)
      .filter(([name]) => name.includes('COMMERCIAL_PROPOSAL_RECORD_PAGE'))
      .map(([, value]) => value);

    expect(view.openRecordIn).toBe(ViewOpenRecordIn.RECORD_PAGE);
    expect(navigationComponent.isHeadless).toBe(true);
    expect(new Set(recordPageIdentifiers).size).toBe(recordPageIdentifiers.length);
  });
});
