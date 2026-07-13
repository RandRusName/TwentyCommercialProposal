import { useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  openSidePanelPage,
  SidePanelPages,
  useColorScheme,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { GENERATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type {
  CommercialProposalDraft,
  CommercialProposalResultMetadata,
} from 'src/domain/commercial-proposal';
import {
  createIdempotencyKey,
  getSafeErrorMessage,
  IDEMPOTENCY_SETUP_ERROR,
} from 'src/front-components/create-commercial-proposal.helpers';
import { callAppRoute } from 'src/front-components/utils/call-app-route';

type GenerateResponse = {
  status: 'success';
  commercialProposal: CommercialProposalDraft;
  generated: boolean;
  result: CommercialProposalResultMetadata;
};

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
      margin: 0,
    } satisfies CSSProperties,
    muted: {
      color: isDark ? '#9ca3af' : '#6b7280',
      fontSize: '13px',
      lineHeight: 1.5,
      margin: 0,
    } satisfies CSSProperties,
    box: {
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      padding: '12px',
      background: isDark ? '#111827' : '#ffffff',
      fontSize: '13px',
      lineHeight: 1.5,
    } satisfies CSSProperties,
    error: {
      border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
      borderRadius: '8px',
      padding: '10px 12px',
      color: isDark ? '#fecaca' : '#991b1b',
      background: isDark ? '#450a0a' : '#fef2f2',
      fontSize: '13px',
      lineHeight: 1.5,
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
  };
};

const GenerateCommercialProposal = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme);
  const commercialProposalId =
    selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    try {
      createIdempotencyKey();
      return null;
    } catch {
      return IDEMPOTENCY_SETUP_ERROR;
    }
  });
  const [idempotencyKey] = useState<string | null>(() => {
    try {
      return createIdempotencyKey();
    } catch {
      return null;
    }
  });
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const disabled =
    commercialProposalId === null ||
    idempotencyKey === null ||
    isGenerating ||
    result !== null;

  const buttonStyle = {
    ...styles.button,
    background: disabled
      ? colorScheme === 'dark'
        ? '#374151'
        : '#e5e7eb'
      : colorScheme === 'dark'
        ? '#f9fafb'
        : '#111827',
    color: disabled
      ? colorScheme === 'dark'
        ? '#d1d5db'
        : '#6b7280'
      : colorScheme === 'dark'
        ? '#111827'
        : '#ffffff',
    cursor: disabled ? 'not-allowed' : 'pointer',
  } satisfies CSSProperties;

  const generate = async () => {
    if (disabled || commercialProposalId === null || idempotencyKey === null) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await callAppRoute<GenerateResponse>(
        '/commercial-proposals/generate',
        {
          commercialProposalId,
          idempotencyKey,
        },
      );
      setResult(response);
      await enqueueSnackbar({
        message: 'Документы сформированы',
        variant: 'success',
      });
    } catch (caughtError) {
      const message = getSafeErrorMessage(
        caughtError,
        'Не удалось сформировать документы коммерческого предложения',
      );
      setError(message);
      await enqueueSnackbar({ message, variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const openRecord = async () => {
    if (result === null) {
      return;
    }

    await openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'commercialProposal',
      recordId: result.commercialProposal.id,
      resetNavigationStack: true,
    });
  };

  return (
    <div style={styles.root}>
      <h2 style={styles.title}>Сформировать документ</h2>
      <p style={styles.muted}>
        Будут сформированы XLSM и PDF через внешний document-service.
      </p>

      <div style={styles.box}>
        CommercialProposal ID
        <br />
        {commercialProposalId ?? 'Выберите ровно одну запись'}
      </div>

      {error !== null && <div style={styles.error}>{error}</div>}

      {result !== null && (
        <div style={styles.success}>
          <strong>Документы сформированы</strong>
          <div style={{ marginTop: '8px' }}>
            Статус: {result.commercialProposal.status}
            <br />
            Generated at: {result.commercialProposal.generatedAt}
            <br />
            {result.result.files.map((file) => (
              <span key={file.format}>
                {file.format.toUpperCase()}: {file.fileName}
                <br />
                SHA-256: {file.sha256}
                <br />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void openRecord()}
            style={{ ...styles.secondaryButton, marginTop: '10px' }}
          >
            Открыть коммерческое предложение
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => void generate()}
        style={buttonStyle}
      >
        {isGenerating
          ? 'Формирование документов...'
          : 'Сформировать XLSM и PDF'}
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    GENERATE_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Сформировать коммерческое предложение',
  description:
    'Формирует XLSM/PDF документы для выбранного CommercialProposal',
  component: GenerateCommercialProposal,
});
