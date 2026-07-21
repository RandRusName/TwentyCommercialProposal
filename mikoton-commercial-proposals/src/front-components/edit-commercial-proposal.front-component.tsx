import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useColorScheme,
  useRecordId,
  useSelectedRecordIds,
  useTranslate,
} from 'twenty-sdk/front-component';
import { Status } from 'twenty-ui/data-display';
import { Callout, Loader } from 'twenty-ui/feedback';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconDeviceFloppy,
  IconFileExport,
  IconPaperclip,
  IconPlus,
  IconRefresh,
  IconTrash,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';

import { EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type {
  RecalculateResult,
  SaveEditorRequest,
  SaveEditorResult,
} from 'src/domain/commercial-proposal-aggregate';
import type {
  CommercialProposalDraft,
  CommercialProposalResultMetadata,
} from 'src/domain/commercial-proposal';
import {
  applyCanonicalResponse,
  buildSaveRequest,
  calculatePreview,
  createEmptyItem,
  createEditorItemFromCatalogItem,
  createEmptyStage,
  createStarterItem,
  duplicateItem,
  duplicateStage,
  formatMoney,
  getGeneratedDocumentFiles,
  getProposalDisplayNumber,
  isAggregateReadyForGeneration,
  isEditorDirty,
  moveEntry,
  removeEntry,
  validateEditorState,
} from 'src/front-components/commercial-proposal-editor/editor-helpers';
import { CatalogPicker } from 'src/front-components/commercial-proposal-editor/catalog-picker';
import { getEditorStyles } from 'src/front-components/commercial-proposal-editor/editor-styles';
import type {
  EditorContextResponse,
  CatalogItemOption,
  EditorItem,
  EditorStage,
  EditorState,
} from 'src/front-components/commercial-proposal-editor/editor-types';
import { createIdempotencyKey } from 'src/front-components/create-commercial-proposal.helpers';
import {
  AppRouteError,
  callAppRoute,
  isApplicationError,
} from 'src/front-components/utils/call-app-route';

const safeEditorError = (error: unknown, fallback: string) => {
  if (error instanceof AppRouteError) return error.message;
  return fallback;
};

type GenerateResponse = {
  status: 'success';
  commercialProposal: CommercialProposalDraft;
  result: CommercialProposalResultMetadata;
};

const getStatusColor = (
  status: EditorState['status'],
): 'gray' | 'yellow' | 'blue' | 'purple' | 'green' | 'red' => {
  if (status === 'GENERATING') return 'yellow';
  if (status === 'GENERATED') return 'blue';
  if (status === 'SENT') return 'purple';
  if (status === 'ACCEPTED') return 'green';
  if (status === 'FAILED' || status === 'REJECTED') return 'red';
  return 'gray';
};

const Field = ({ label, value, onChange, disabled, multiline = false, type = 'text', error }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  multiline?: boolean;
  type?: 'text' | 'number';
  error?: string;
}) => {
  const styles = getEditorStyles(useColorScheme());
  const id = useId();
  return (
    <label style={styles.field} htmlFor={id}>
      <span style={styles.label}>{label}</span>
      {multiline ? (
        <textarea id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={styles.textarea} />
      ) : (
        <input id={id} type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={styles.input} />
      )}
      {error !== undefined && <span style={{ color: '#dc2626', fontSize: '11px' }}>{error}</span>}
    </label>
  );
};

const EditCommercialProposal = () => {
  const { t } = useTranslate();
  const selectedRecordIds = useSelectedRecordIds();
  const recordPageRecordId = useRecordId();
  const styles = getEditorStyles(useColorScheme());
  const proposalId =
    recordPageRecordId ??
    (selectedRecordIds.length === 1 ? selectedRecordIds[0] : null);
  const [context, setContext] = useState<EditorContextResponse | null>(null);
  const [canonical, setCanonical] = useState<EditorState | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [starterSuggestionDismissed, setStarterSuggestionDismissed] =
    useState(false);
  const pendingSave = useRef<SaveEditorRequest | null>(null);
  const generationOperationId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (proposalId === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await callAppRoute<EditorContextResponse>(
        `/commercial-proposals/${encodeURIComponent(proposalId)}/editor-context`,
        {},
      );
      const next = applyCanonicalResponse(response);
      setContext(response);
      setCanonical(next);
      setState(next);
      setConflict(false);
      setNotice(null);
      setStarterSuggestionDismissed(false);
      setDocumentsOpen(false);
      pendingSave.current = null;
    } catch (caught) {
      setError(safeEditorError(caught, t('Unable to complete the editor operation. Refresh the data and try again.')));
    } finally {
      setLoading(false);
    }
  }, [proposalId, t]);

  useEffect(() => void load(), [load]);

  const editable = context?.isEditable === true && !saving;
  const dirty = state !== null && canonical !== null && isEditorDirty(state, canonical);
  const validation = useMemo(
    () => (state === null ? { valid: false, errors: {} } : validateEditorState(state)),
    [state],
  );
  const preview = useMemo(() => (state === null ? null : calculatePreview(state)), [state]);
  const generatedFiles = useMemo(
    () => getGeneratedDocumentFiles(context?.proposal.resultMetadata ?? null),
    [context?.proposal.resultMetadata],
  );
  const aggregateReadyForGeneration =
    state !== null &&
    isAggregateReadyForGeneration(state, validation, preview);
  const canGenerate =
    state !== null &&
    context?.generationAvailability.allowed === true &&
    !dirty &&
    !saving &&
    !generating &&
    (state.status === 'DRAFT' || state.status === 'FAILED') &&
    (state.contentModelVersion === 'LEGACY_V1' || aggregateReadyForGeneration);

  const edit = (updater: (current: EditorState) => EditorState) => {
    if (!editable) return;
    pendingSave.current = null;
    setConflict(false);
    setNotice(null);
    setConfirmReset(false);
    setState((current) => (current === null ? current : updater(current)));
  };

  const save = async () => {
    if (state === null || context === null || !editable || !dirty || !validation.valid) return;
    const request = pendingSave.current ?? buildSaveRequest(state);
    pendingSave.current = request;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await callAppRoute<{ status: 'success' } & SaveEditorResult>(
        `/commercial-proposals/${encodeURIComponent(state.proposalId)}/save-editor`,
        { ...request },
      );
      const canonicalResponse: EditorContextResponse = {
        ...context,
        proposal: response.proposal,
        items: response.items,
        stages: response.stages,
        isEditable: response.proposal.status === 'DRAFT' || response.proposal.status === 'FAILED',
        generationAvailability: { allowed: true, reason: null },
      };
      const next = applyCanonicalResponse(canonicalResponse);
      setContext(canonicalResponse);
      setCanonical(next);
      setState(next);
      pendingSave.current = null;
      await load();
      setNotice(response.replayed ? t('Saved operation confirmed') : t('Changes saved'));
      await enqueueSnackbar({ message: t('Commercial proposal saved'), variant: 'success' });
    } catch (caught) {
      if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT')) {
        setConflict(true);
        setError(t('The proposal was changed in another tab or operation.'));
      } else if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_INVALID_STATUS')) {
        setError(t('The proposal status changed. Load the latest version.'));
      } else if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_DATA_INTEGRITY_ERROR')) {
        setError(t('The proposal contains conflicting technical records. Data review is required.'));
      } else {
        setError(safeEditorError(caught, t('Unable to complete the editor operation. Refresh the data and try again.')));
      }
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (state === null || !editable) return;
    setError(null);
    try {
      const result = await callAppRoute<{ status: 'success' } & RecalculateResult>(
        `/commercial-proposals/${encodeURIComponent(state.proposalId)}/recalculate`,
        {
          currencyCode: state.header.currencyCode?.trim().toUpperCase() || null,
          items: state.items.map(({ clientKey, quantity, unitPrice, discountPercent }) => ({ clientKey, quantity, unitPrice, discountPercent })),
        },
      );
      setNotice(t('Server total: {amount}', { amount: formatMoney(result.amount, result.currencyCode) }));
    } catch (caught) {
      setError(safeEditorError(caught, t('Unable to complete the editor operation. Refresh the data and try again.')));
    }
  };

  const generate = async () => {
    if (state === null || !canGenerate) return;

    setGenerating(true);
    setError(null);
    setNotice(null);

    try {
      generationOperationId.current ??= createIdempotencyKey();
      const response = await callAppRoute<GenerateResponse>(
        '/commercial-proposals/generate',
        {
          commercialProposalId: state.proposalId,
          idempotencyKey: generationOperationId.current,
        },
      );
      generationOperationId.current = null;
      await load();
      setDocumentsOpen(true);
      setNotice(
        t('Documents generated: {files}', { files: response.result.files.map((file) => file.fileName).join(', ') }),
      );
      await enqueueSnackbar({
        message: t('XLSX and PDF were generated and attached to the proposal'),
        variant: 'success',
      });
    } catch (caught) {
      setError(safeEditorError(caught, t('Unable to complete the editor operation. Refresh the data and try again.')));
    } finally {
      setGenerating(false);
    }
  };

  if (proposalId === null) {
    return (
      <div style={styles.root}>
        <Callout
          variant="neutral"
          title={t('Commercial proposal is not selected')}
          description={t('Open exactly one commercial proposal record.')}
        />
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ ...styles.root, display: 'grid', placeItems: 'center' }}>
        <Loader />
      </div>
    );
  }
  if (state === null || context === null) {
    return (
      <div style={styles.root}>
        <Callout
          variant="error"
          title={t('Unable to load the proposal')}
          description={error ?? t('Refresh the page and try again.')}
        />
      </div>
    );
  }

  const setHeader = (key: keyof EditorState['header'], value: string | number | null) =>
    edit((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  const updateItem = (index: number, patch: Partial<EditorItem>) =>
    edit((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const updateStage = (index: number, patch: Partial<EditorStage>) =>
    edit((current) => ({ ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage) }));
  const addCatalogItems = (catalogItems: CatalogItemOption[]) => {
    if (catalogItems.length === 0) return;
    const currencyCode = catalogItems[0]?.currencyCode ?? null;
    if (catalogItems.some((item) => item.currencyCode !== currencyCode)) {
      setError(t('All selected items must use one currency.'));
      return;
    }
    if (state.header.currencyCode !== null && state.header.currencyCode !== currencyCode) {
      setError(t('The catalog item currency does not match the proposal currency.'));
      return;
    }
    edit((current) => ({
      ...current,
      header: {
        ...current.header,
        currencyCode: current.header.currencyCode ?? currencyCode,
      },
      items: [
        ...current.items,
        ...catalogItems.map(createEditorItemFromCatalogItem),
      ],
    }));
    setCatalogOpen(false);
  };

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{getProposalDisplayNumber(state.number)}</h2>
          <div style={styles.muted}>{state.header.title}</div>
        </div>
        <div style={styles.actions}>
          <Status
            color={getStatusColor(state.status)}
            isLoaderVisible={state.status === 'GENERATING' || generating}
            text={state.status}
            weight="medium"
          />
          {(state.status === 'DRAFT' || state.status === 'FAILED') && (
            <Button
              Icon={IconFileExport}
              title={generating ? t('Generating...') : t('Generate documents')}
              variant="primary"
              accent="blue"
              size="small"
              disabled={!canGenerate}
              isLoading={generating}
              onClick={() => void generate()}
            />
          )}
        </div>
      </div>

      {error !== null && (
        <div style={{ marginTop: '12px' }}>
          <Callout variant="error" title={t('Operation failed')} description={error} />
          {conflict && (
            <div style={{ ...styles.header, marginTop: '8px' }}>
              <span style={styles.muted}>{t('Local changes remain on screen until reload.')}</span>
              <Button
                Icon={IconRefresh}
                title={t('Load latest version')}
                variant="secondary"
                size="small"
                onClick={() => void load()}
              />
            </div>
          )}
        </div>
      )}
      {dirty && !validation.valid && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="warning"
            title={t('Draft is incomplete')}
            description={t('Fix the highlighted fields before saving.')}
          />
        </div>
      )}
      {notice !== null && (
        <div style={{ marginTop: '12px' }}>
          <Callout variant="success" title={t('Done')} description={notice} />
        </div>
      )}
      {(context.warnings?.length ?? 0) > 0 && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="warning"
            title={t('Opportunity context is partially available')}
            description={t('Opportunity or Company is currently unavailable. The saved proposal content is fully loaded.')}
          />
        </div>
      )}
      {!context.isEditable && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="neutral"
            title={t('Proposal is read-only')}
            description={t('Editing is available only in DRAFT and FAILED statuses.')}
          />
        </div>
      )}

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.sectionTitle}>{t('Documents')}</h3>
            <div style={styles.muted}>
              {generatedFiles.length === 0
                ? t('No generated files yet')
                : t('Attached files: {count}', { count: generatedFiles.length })}
            </div>
          </div>
          <Button
            Icon={IconPaperclip}
            title={documentsOpen ? t('Hide files') : t('Show files')}
            variant="tertiary"
            size="small"
            disabled={generatedFiles.length === 0}
            onClick={() => setDocumentsOpen((value) => !value)}
          />
        </div>
        {documentsOpen && generatedFiles.length > 0 && (
          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            {generatedFiles.map((file) => (
              <a
                key={`${file.format}-${file.sha256}`}
                href={file.twentyFileUrl ?? file.downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {file.fileName}
              </a>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>{t('Opportunity context')}</h3><div style={styles.grid}><div><span style={styles.label}>{t('Opportunity')}</span><div>{context.opportunity?.name ?? t('Not specified')}</div></div><div><span style={styles.label}>{t('Opportunity forecast')}</span><div>{formatMoney(context.opportunity?.amount ?? null, context.opportunity?.currencyCode ?? null)}</div></div><div><span style={styles.label}>{t('Company')}</span><div>{context.company?.name ?? t('Company not specified')}</div></div></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>{t('General information')}</h3><div style={styles.grid}>
        <Field label={t('Title')} value={state.header.title} disabled={!editable} onChange={(value) => setHeader('title', value)} error={validation.errors.title} />
        <Field label={t('Contact')} value={state.header.contactName ?? ''} disabled={!editable} onChange={(value) => setHeader('contactName', value)} />
        <Field label={t('Currency')} value={state.header.currencyCode ?? ''} disabled={!editable} onChange={(value) => setHeader('currencyCode', value.toUpperCase())} error={validation.errors.currencyCode} />
        <Field label={t('Validity period, days')} type="number" value={String(state.header.validityDays)} disabled={!editable} onChange={(value) => setHeader('validityDays', Number(value))} error={validation.errors.validityDays} />
      </div><div style={{ marginTop: '10px' }}><Field label={t('Context and goal')} value={state.header.contextAndGoal ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('contextAndGoal', value)} /></div></section>

      {context.legacySuggestion.canCreateStarterItem && state.items.length === 0 && !starterSuggestionDismissed && (
        <div style={{ marginTop: '16px' }}>
          <Callout
            variant="warning"
            title={t('Proposal uses the legacy format')}
            description={t('Saving at least one item permanently converts it to the new model. The previous amount is retained while the work list remains empty.')}
          />
          <div style={{ ...styles.actions, marginTop: '8px' }}>
            <Button
              Icon={IconPlus}
              title={t('Create starter row')}
              variant="secondary"
              size="small"
              disabled={!editable}
              onClick={() =>
                edit((current) => ({
                  ...current,
                  items: [createStarterItem(context.legacySuggestion)],
                }))
              }
            />
            <Button
              title={t('Start with empty table')}
              variant="tertiary"
              size="small"
              disabled={!editable}
              onClick={() => {
                setStarterSuggestionDismissed(true);
                setNotice(t('Add the first row manually.'));
              }}
            />
          </div>
        </div>
      )}

      {state.contentModelVersion === 'AGGREGATE_V2' && !aggregateReadyForGeneration && (state.status === 'DRAFT' || state.status === 'FAILED') && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="info"
            title={t('Documents cannot be generated yet')}
              description={
                state.header.contactName?.trim()
                  ? t('Add at least one valid item and one stage with a result and duration, save changes, and ensure the total is greater than zero.')
                  : t('Specify the customer contact, then add an item and a stage with a result and duration.')
              }
          />
        </div>
      )}

      <section style={styles.section}>
        <div style={styles.header}>
          <h3 style={styles.sectionTitle}>{t('Work items')}</h3>
          {editable && (
            <div style={styles.actions}>
              <Button
                Icon={IconPlus}
                title={t('Add from catalog')}
                variant="secondary"
                size="small"
                onClick={() => setCatalogOpen((value) => !value)}
              />
              <Button
                Icon={IconPlus}
                title={t('Add row')}
                variant="secondary"
                size="small"
                onClick={() =>
                  edit((current) => ({
                    ...current,
                    items: [...current.items, createEmptyItem()],
                  }))
                }
              />
            </div>
          )}
        </div>
        {catalogOpen && (
          <CatalogPicker
            currencyCode={state.header.currencyCode}
            onAdd={addCatalogItems}
            onClose={() => setCatalogOpen(false)}
          />
        )}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[t('No.'), t('Source'), t('Block'), t('Name'), t('Description'), t('Quantity'), t('Unit'), t('Rate'), t('Discount, %'), t('Amount'), t('Actions')].map((label) => (
                  <th key={label} style={styles.cell}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.items.map((item, index) => (
                <tr key={item.clientKey}>
                  <td style={styles.cell}>{index + 1}</td>
                  <td style={styles.cell}>{item.catalogItemId === null ? t('Manual') : t('Catalog')}</td>
                  {(['block', 'name', 'description', 'quantity', 'unit', 'unitPrice', 'discountPercent'] as const).map((key) => (
                    <td key={key} style={styles.cell}>
                      <input
                        aria-label={`${key} ${index + 1}`}
                        style={{ ...styles.input, width: key === 'description' ? '190px' : '100px' }}
                        disabled={!editable}
                        value={item[key]}
                        onChange={(event) => updateItem(index, { [key]: event.target.value })}
                      />
                      {validation.errors[`items.${index}.${key}`] !== undefined && (
                        <div style={{ color: '#dc2626' }}>{validation.errors[`items.${index}.${key}`]}</div>
                      )}
                    </td>
                  ))}
                  <td style={styles.cell}>{formatMoney(calculatePreview({ ...state, items: [item] }), state.header.currencyCode)}</td>
                  <td style={styles.cell}>
                    {editable && (
                      <div style={styles.actions}>
                        <IconButton Icon={IconCopy} variant="tertiary" size="small" ariaLabel="Дублировать строку" onClick={() => edit((current) => ({ ...current, items: [...current.items.slice(0, index + 1), duplicateItem(item), ...current.items.slice(index + 1)] }))} />
                        <IconButton Icon={IconArrowUp} variant="tertiary" size="small" ariaLabel="Переместить строку вверх" disabled={index === 0} onClick={() => edit((current) => ({ ...current, items: moveEntry(current.items, index, -1) }))} />
                        <IconButton Icon={IconArrowDown} variant="tertiary" size="small" ariaLabel="Переместить строку вниз" disabled={index === state.items.length - 1} onClick={() => edit((current) => ({ ...current, items: moveEntry(current.items, index, 1) }))} />
                        <IconButton Icon={IconTrash} variant="tertiary" accent="danger" size="small" ariaLabel="Удалить строку" onClick={() => edit((current) => ({ ...current, items: removeEntry(current.items, index) }))} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.sectionTitle}>{t('Work plan')}</h3>
            <div style={styles.muted}>{t('Result and duration are required before document generation.')}</div>
          </div>
          {editable && (
            <Button
              Icon={IconPlus}
              title={t('Add stage')}
              variant="secondary"
              size="small"
              onClick={() => edit((current) => ({ ...current, stages: [...current.stages, createEmptyStage()] }))}
            />
          )}
        </div>
        {state.stages.map((stage, index) => (
          <div key={stage.clientKey} style={{ ...styles.grid, marginBottom: '12px' }}>
            <Field label={t('Stage {number}', { number: index + 1 })} value={stage.title} disabled={!editable} onChange={(value) => updateStage(index, { title: value })} error={validation.errors[`stages.${index}.title`]} />
            <Field label={t('Result')} value={stage.result} disabled={!editable} onChange={(value) => updateStage(index, { result: value })} />
            <Field label={t('Duration')} value={stage.duration} disabled={!editable} onChange={(value) => updateStage(index, { duration: value })} />
            <Field label={t('Description')} value={stage.description} disabled={!editable} onChange={(value) => updateStage(index, { description: value })} />
            {editable && (
              <div style={styles.actions}>
                <IconButton Icon={IconCopy} variant="tertiary" size="small" ariaLabel="Дублировать этап" onClick={() => edit((current) => ({ ...current, stages: [...current.stages.slice(0, index + 1), duplicateStage(stage), ...current.stages.slice(index + 1)] }))} />
                <IconButton Icon={IconArrowUp} variant="tertiary" size="small" ariaLabel="Переместить этап вверх" disabled={index === 0} onClick={() => edit((current) => ({ ...current, stages: moveEntry(current.stages, index, -1) }))} />
                <IconButton Icon={IconArrowDown} variant="tertiary" size="small" ariaLabel="Переместить этап вниз" disabled={index === state.stages.length - 1} onClick={() => edit((current) => ({ ...current, stages: moveEntry(current.stages, index, 1) }))} />
                <IconButton Icon={IconTrash} variant="tertiary" accent="danger" size="small" ariaLabel="Удалить этап" onClick={() => edit((current) => ({ ...current, stages: removeEntry(current.stages, index) }))} />
              </div>
            )}
          </div>
        ))}
      </section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>{t('Terms')}</h3><div style={styles.grid}><Field label={t('Payment terms')} value={state.header.paymentTerms ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('paymentTerms', value)} /><Field label={t('Assumptions')} value={state.header.assumptions ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('assumptions', value)} /><Field label={t('Next step')} value={state.header.nextStep ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('nextStep', value)} /></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>{t('Total')}</h3><strong>{formatMoney(preview, state.header.currencyCode)}</strong><div style={styles.muted}>{t('Preview total. The server returns the canonical amount after saving.')}</div></section>

      <div style={styles.sticky}>
        <div style={styles.muted}>{dirty ? t('There are unsaved changes') : t('All changes are saved')}</div>
        {context.isEditable && (
          <div style={styles.actions}>
            <Button Icon={IconRefresh} title={t('Recalculate')} variant="tertiary" size="small" disabled={saving || generating} onClick={() => void recalculate()} />
            <Button
              title={confirmReset ? t('Confirm reset') : t('Reset changes')}
              variant="secondary"
              size="small"
              disabled={!dirty || saving || generating}
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  setNotice(t('Select Confirm reset to discard local changes.'));
                  return;
                }
                if (canonical !== null) setState(structuredClone(canonical));
                setConfirmReset(false);
                setNotice(null);
                pendingSave.current = null;
              }}
            />
            <Button
              Icon={IconDeviceFloppy}
              title={saving ? t('Saving...') : t('Save')}
              variant="primary"
              accent="blue"
              size="small"
              disabled={!dirty || !validation.valid || saving || generating}
              isLoading={saving}
              onClick={() => void save()}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Редактор коммерческого предложения',
  description: 'Редактирует состав, этапы и условия CommercialProposal',
  component: EditCommercialProposal,
});
