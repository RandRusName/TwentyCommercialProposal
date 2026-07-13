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
  SUPPORTED_LANGUAGE,
  SUPPORTED_TEMPLATE_CODE,
} from 'src/domain/commercial-proposal';
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

const createIdempotencyKey = () => {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatAmount = (amount: number | null, currencyCode: string | null) => {
  if (amount === null) {
    return 'Сумма не указана';
  }

  return `${amount.toLocaleString('ru-RU')} ${currencyCode ?? ''}`.trim();
};

const Field = ({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof getStyles>;
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
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '10px 12px',
      color: '#991b1b',
      background: '#fef2f2',
      fontSize: '13px',
      lineHeight: 1.5,
    } satisfies CSSProperties,
    success: {
      border: '1px solid #bbf7d0',
      borderRadius: '8px',
      padding: '10px 12px',
      color: '#166534',
      background: '#f0fdf4',
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
  const [idempotencyKey] = useState(() => createIdempotencyKey());

  useEffect(() => {
    if (opportunityId === null) {
      return;
    }

    const loadContext = async () => {
      setIsLoadingContext(true);
      setError(null);
      setDraft(null);

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
            : 'Не удалось загрузить данные сделки',
        );
      } finally {
        setIsLoadingContext(false);
      }
    };

    void loadContext();
  }, [opportunityId]);

  const openDraft = async (draftToOpen: CommercialProposalDraft) => {
    await openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'commercialProposal',
      recordId: draftToOpen.id,
      resetNavigationStack: true,
    });
  };

  const createDraft = async () => {
    if (opportunityId === null || isCreating || draft !== null) {
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
          ? 'Черновик коммерческого предложения создан'
          : 'Открыт существующий черновик',
        variant: 'success',
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Не удалось создать черновик коммерческого предложения';
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

  const createDisabled =
    isCreating || isLoadingContext || opportunity === null || draft !== null;
  const createButtonStyle = {
    ...styles.button,
    background:
      createDisabled ? '#e5e7eb' : colorScheme === 'dark' ? '#f9fafb' : '#111827',
    color:
      createDisabled ? '#6b7280' : colorScheme === 'dark' ? '#111827' : '#ffffff',
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
