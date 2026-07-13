import { useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  openSidePanelPage,
  SidePanelPages,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type {
  CommercialProposalDraft,
  OpportunityContext,
} from 'src/domain/commercial-proposal';
import {
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
} from 'src/domain/commercial-proposal';
import { callAppRoute } from 'src/front-components/utils/call-app-route';

type OpportunityContextResponse = {
  opportunity: OpportunityContext;
};

type CreateDraftResponse = {
  status: 'success';
  draft: CommercialProposalDraft;
  created: boolean;
};

const createIdempotencyKey = () => {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const boxStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const labelStyle = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: 1.4,
} satisfies React.CSSProperties;

const valueStyle = {
  color: '#111827',
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: 1.5,
  marginTop: '4px',
} satisfies React.CSSProperties;

const CreateCommercialProposal = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const opportunityId =
    selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;
  const [opportunity, setOpportunity] = useState<OpportunityContext | null>(
    null,
  );
  const [draft, setDraft] = useState<CommercialProposalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const idempotencyKey = useMemo(() => createIdempotencyKey(), []);

  useEffect(() => {
    if (opportunityId === null) {
      return;
    }

    const loadContext = async () => {
      setIsLoadingContext(true);
      setError(null);

      try {
        const result = await callAppRoute<OpportunityContextResponse>(
          '/commercial-proposals/opportunity-context',
          { opportunityId },
        );
        setOpportunity(result.opportunity);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load opportunity context',
        );
      } finally {
        setIsLoadingContext(false);
      }
    };

    void loadContext();
  }, [opportunityId]);

  const createDraft = async () => {
    if (opportunityId === null) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await callAppRoute<CreateDraftResponse>(
        '/commercial-proposals/drafts',
        {
          source: {
            object: 'opportunity',
            recordId: opportunityId,
          },
          templateCode: SUPPORTED_TEMPLATE_CODE,
          language: SUPPORTED_LANGUAGE,
          idempotencyKey,
        },
      );
      setDraft(result.draft);
      await enqueueSnackbar({
        message: result.created
          ? 'Commercial proposal draft created'
          : 'Existing draft opened',
        variant: 'success',
      });
      await openSidePanelPage({
        page: SidePanelPages.ViewRecord,
        objectNameSingular: 'commercialProposal',
        recordId: result.draft.id,
        resetNavigationStack: true,
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to create commercial proposal draft';
      setError(message);
      await enqueueSnackbar({
        message,
        variant: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (opportunityId === null) {
    return (
      <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif' }}>
        Select exactly one opportunity to create a commercial proposal.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div>
        <h2
          style={{
            fontSize: '18px',
            lineHeight: 1.3,
            margin: '0 0 4px',
            color: '#111827',
          }}
        >
          Create commercial proposal
        </h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          A draft record will be linked to the current opportunity and company.
        </p>
      </div>

      {isLoadingContext ? (
        <div style={boxStyle}>Loading opportunity context...</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={boxStyle}>
            <div style={labelStyle}>Opportunity</div>
            <div style={valueStyle}>{opportunity?.name ?? opportunityId}</div>
          </div>
          <div style={boxStyle}>
            <div style={labelStyle}>Company</div>
            <div style={valueStyle}>{opportunity?.companyName ?? 'Not set'}</div>
          </div>
          <div style={boxStyle}>
            <div style={labelStyle}>Amount</div>
            <div style={valueStyle}>
              {opportunity?.amount ?? 'Not set'} {opportunity?.currency ?? ''}
            </div>
          </div>
        </div>
      )}

      {error !== null && (
        <div
          style={{
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#991b1b',
            background: '#fef2f2',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {draft !== null && (
        <div
          style={{
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 12px',
            color: '#166534',
            background: '#f0fdf4',
            fontSize: '13px',
          }}
        >
          Draft {draft.number} is ready.
        </div>
      )}

      <button
        type="button"
        onClick={() => void createDraft()}
        disabled={isCreating || isLoadingContext || opportunity === null}
        style={{
          border: '1px solid #111827',
          borderRadius: '8px',
          padding: '10px 14px',
          background:
            isCreating || isLoadingContext || opportunity === null
              ? '#e5e7eb'
              : '#111827',
          color:
            isCreating || isLoadingContext || opportunity === null
              ? '#6b7280'
              : '#ffffff',
          cursor:
            isCreating || isLoadingContext || opportunity === null
              ? 'not-allowed'
              : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        {isCreating ? 'Creating...' : 'Create draft'}
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Create commercial proposal',
  description: 'Creates a CommercialProposal draft from one selected opportunity',
  component: CreateCommercialProposal,
});
