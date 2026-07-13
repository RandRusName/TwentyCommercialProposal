import { useEffect, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  openSidePanelPage,
  SidePanelPages,
  useColorScheme,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type {
  CommercialProposalDraft,
  OpportunityContext,
} from 'src/domain/commercial-proposal';
import {
  buildCreateDraftRequest,
  createIdempotencyKey,
  formatAmount,
  getSafeErrorMessage,
  IDEMPOTENCY_SETUP_ERROR,
  isCreateDraftDisabled,
} from 'src/front-components/create-commercial-proposal.helpers';
import { callAppRoute } from 'src/front-components/utils/call-app-route';

type OpportunityContextResponse = {
  status: 'success';
  opportunity: OpportunityContext;
};

type CreateDraftResponse = {
  status: 'success';
  draft: CommercialProposalDraft;
  created: boolean;
};

type Styles = ReturnType<typeof getStyles>;

const Field = ({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: Styles;
}) => (
  <div style={styles.box}>
    <div style={styles.label}>{label}</div>
    <div style={styles.value}>{value}</div>
  </div>
);

const getStyles = (colorScheme: 'light' | 'dark') => {
  const isDark = colorScheme === 'dark';

  return {
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      color: isDark ? '#f9fafb' : '#111827',
      fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    } satisfies CSSProperties,
    title: {
      fontSize: '18px',
      lineHeight: 1.3,
      margin: '0 0 4px',
      color: isDark ? '#f9fafb' : '#111827',
    } satisfies CSSProperties,
    subtitle: {
      margin: 0,
      color: isDark ? '#9ca3af' : '#6b7280',
      fontSize: '13px',
      lineHeight: 1.5,
    } satisfies CSSProperties,
    box: {
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      padding: '12px',
      background: isDark ? '#111827' : '#ffffff',
    } satisfies CSSProperties,
    label: {
      color: isDark ? '#9ca3af' : '#6b7280',
      fontSize: '12px',
      lineHeight: 1.4,
    } satisfies CSSProperties,
    value: {
      color: isDark ? '#f9fafb' : '#111827',
      fontSize: '14px',
      fontWeight: 500,
      lineHeight: 1.5,
      marginTop: '4px',
    } satisfies CSSProperties,
    button: {
      border: `1px solid ${isDark ? '#f9fafb' : '#111827'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '14px',
      fontWeight: 600,
    } satisfies CSSProperties,
    secondaryButton: {
      border: `1px solid ${isDark ? '#4b5563' : '#d1d5db'}`,
      borderRadius: '8px',
      padding: '10px 14px',
      background: 'transparent',
      color: isDark ? '#f9fafb' : '#111827',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600,
    } satisfies CSSProperties,
    error: {
      border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
      borderRadius: '8px',
      padding: '10px 12px',
      color: isDark ? '#fecaca' : '#991b1b',
      background: isDark ? '#450a0a' : '#fef2f2',
      fontSize: '13px',
      lineHeight: 1.5,
      whiteSpace: 'pre-line',
    } satisfies CSSProperties,
    success: {
      border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`,
      borderRadius: '8px',
      padding: '10px 12px',
      color: isDark ? '#bbf7d0' : '#166534',
      background: isDark ? '#052e16' : '#f0fdf4',
      fontSize: '13px',
      lineHeight: 1.5,
    } satisfies CSSProperties,
  };
};

const CreateCommercialProposal = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme);
  const opportunityId =
    selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;
  const [opportunity, setOpportunity] = useState<OpportunityContext | null>(
    null,
  );
  const [draft, setDraft] = useState<CommercialProposalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [idempotencyKey] = useState<string | null>(() => {
    try {
      return createIdempotencyKey();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (idempotencyKey === null) {
      setError(IDEMPOTENCY_SETUP_ERROR);
    }
  }, [idempotencyKey]);

  useEffect(() => {
    if (opportunityId === null) {
      return;
    }

    const loadContext = async () => {
      setIsLoadingContext(true);
      setError(idempotencyKey === null ? IDEMPOTENCY_SETUP_ERROR : null);
      setDraft(null);

      try {
        const result = await callAppRoute<OpportunityContextResponse>(
          '/commercial-proposals/opportunity-context',
          { opportunityId },
        );
        setOpportunity(result.opportunity);
      } catch (caughtError) {
        setError(
          getSafeErrorMessage(caughtError, 'Не удалось загрузить данные сделки'),
        );
      } finally {
        setIsLoadingContext(false);
      }
    };

    void loadContext();
  }, [idempotencyKey, opportunityId]);

  const openDraft = async (draftToOpen: CommercialProposalDraft) => {
    await openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'commercialProposal',
      recordId: draftToOpen.id,
      resetNavigationStack: true,
    });
  };

  const createDraft = async () => {
    if (
      opportunityId === null ||
      idempotencyKey === null ||
      isCreating ||
      draft !== null
    ) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await callAppRoute<CreateDraftResponse>(
        '/commercial-proposals/drafts',
        buildCreateDraftRequest({ opportunityId, idempotencyKey }),
      );
      setDraft(result.draft);
      await enqueueSnackbar({
        message: result.created
          ? 'Черновик коммерческого предложения создан'
          : 'Открыт существующий черновик',
        variant: 'success',
      });
    } catch (caughtError) {
      const message = getSafeErrorMessage(
        caughtError,
        'Не удалось создать черновик коммерческого предложения',
      );
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
      <div style={styles.root}>
        Выберите ровно одну сделку, чтобы создать коммерческое предложение.
      </div>
    );
  }

  const createDisabled = isCreateDraftDisabled({
    isCreating,
    isLoadingContext,
    hasOpportunity: opportunity !== null,
    hasDraft: draft !== null,
    hasIdempotencyKey: idempotencyKey !== null,
  });
  const createButtonStyle = {
    ...styles.button,
    background: createDisabled
      ? colorScheme === 'dark'
        ? '#374151'
        : '#e5e7eb'
      : colorScheme === 'dark'
        ? '#f9fafb'
        : '#111827',
    color: createDisabled
      ? colorScheme === 'dark'
        ? '#d1d5db'
        : '#6b7280'
      : colorScheme === 'dark'
        ? '#111827'
        : '#ffffff',
    cursor: createDisabled ? 'not-allowed' : 'pointer',
  } satisfies CSSProperties;

  return (
    <div style={styles.root}>
      <div>
        <h2 style={styles.title}>Создать коммерческое предложение</h2>
        <p style={styles.subtitle}>
          Черновик будет связан с текущей сделкой и компанией.
        </p>
      </div>

      {isLoadingContext ? (
        <div style={styles.box}>Загрузка данных сделки...</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          <Field
            label="Сделка"
            value={opportunity?.name ?? opportunityId}
            styles={styles}
          />
          <Field
            label="Компания"
            value={opportunity?.company?.name ?? 'Компания не указана'}
            styles={styles}
          />
          <Field
            label="Сумма"
            value={formatAmount(
              opportunity?.amount ?? null,
              opportunity?.currencyCode ?? null,
            )}
            styles={styles}
          />
          <Field
            label="Шаблон"
            value="Стандартное коммерческое предложение"
            styles={styles}
          />
          <Field label="Язык" value="Русский" styles={styles} />
        </div>
      )}

      {error !== null && <div style={styles.error}>{error}</div>}

      {draft !== null && (
        <div style={styles.success}>
          <strong>Черновик коммерческого предложения создан</strong>
          <div style={{ marginTop: '8px' }}>
            Номер: {draft.number}
            <br />
            Название: {draft.title}
            <br />
            Статус: {draft.status}
          </div>
          <button
            type="button"
            onClick={() => void openDraft(draft)}
            style={{ ...styles.secondaryButton, marginTop: '10px' }}
          >
            Открыть коммерческое предложение
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => void createDraft()}
        disabled={createDisabled}
        style={createButtonStyle}
      >
        {isCreating ? 'Создание черновика...' : 'Создать черновик'}
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    CREATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Создать коммерческое предложение',
  description: 'Создаёт черновик CommercialProposal из выбранной сделки',
  component: CreateCommercialProposal,
});
