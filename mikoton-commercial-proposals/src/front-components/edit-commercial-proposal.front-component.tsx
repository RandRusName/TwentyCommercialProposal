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
} from 'twenty-sdk/front-component';
import { Status } from 'twenty-ui/data-display';
import { Callout, Loader } from 'twenty-ui/feedback';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconDeviceFloppy,
  IconFileExport,
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
  getProposalDisplayNumber,
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

const safeEditorError = (error: unknown) => {
  if (error instanceof AppRouteError) return error.message;
  return 'Не удалось выполнить операцию редактора. Обновите данные и повторите попытку.';
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
      pendingSave.current = null;
    } catch (caught) {
      setError(safeEditorError(caught));
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => void load(), [load]);

  const editable = context?.isEditable === true && !saving;
  const dirty = state !== null && canonical !== null && isEditorDirty(state, canonical);
  const validation = useMemo(
    () => (state === null ? { valid: false, errors: {} } : validateEditorState(state)),
    [state],
  );
  const preview = useMemo(() => (state === null ? null : calculatePreview(state)), [state]);
  const aggregateReadyForGeneration =
    state !== null &&
    state.items.length > 0 &&
    state.stages.length > 0 &&
    state.stages.every(
      (stage) => stage.title.trim() !== '' && stage.result.trim() !== '' && stage.duration.trim() !== '',
    ) &&
    validation.valid &&
    (preview ?? 0) > 0;
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
      setNotice(response.replayed ? 'Сохранённая операция подтверждена' : 'Изменения сохранены');
      await enqueueSnackbar({ message: 'Коммерческое предложение сохранено', variant: 'success' });
    } catch (caught) {
      if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_EDITOR_CONFLICT')) {
        setConflict(true);
        setError('КП было изменено в другой вкладке или операции.');
      } else if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_INVALID_STATUS')) {
        setError('Статус КП изменился. Загрузите актуальную версию.');
      } else if (isApplicationError(caught, 'COMMERCIAL_PROPOSAL_DATA_INTEGRITY_ERROR')) {
        setError('Состав КП содержит конфликтующие технические записи. Требуется проверка данных.');
      } else {
        setError(safeEditorError(caught));
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
      setNotice(`Серверный итог: ${formatMoney(result.amount, result.currencyCode)}`);
    } catch (caught) {
      setError(safeEditorError(caught));
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
      setNotice(
        `Документы сформированы: ${response.result.files.map((file) => file.fileName).join(', ')}`,
      );
      await enqueueSnackbar({
        message: 'XLSX и PDF сформированы и приложены к КП',
        variant: 'success',
      });
    } catch (caught) {
      setError(safeEditorError(caught));
    } finally {
      setGenerating(false);
    }
  };

  if (proposalId === null) {
    return (
      <div style={styles.root}>
        <Callout
          variant="neutral"
          title="Коммерческое предложение не выбрано"
          description="Откройте ровно одну запись Commercial Proposal."
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
          title="Не удалось загрузить КП"
          description={error ?? 'Обновите страницу и повторите попытку.'}
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
      setError('Все выбранные позиции должны иметь одну валюту.');
      return;
    }
    if (state.header.currencyCode !== null && state.header.currencyCode !== currencyCode) {
      setError('Валюта позиции каталога не совпадает с валютой КП.');
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
              title={generating ? 'Формирование...' : 'Сформировать документы'}
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
          <Callout variant="error" title="Операция не выполнена" description={error} />
          {conflict && (
            <div style={{ ...styles.header, marginTop: '8px' }}>
              <span style={styles.muted}>Локальные изменения останутся на экране до перезагрузки.</span>
              <Button
                Icon={IconRefresh}
                title="Загрузить актуальную версию"
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
            title="Черновик заполнен не полностью"
            description="Исправьте отмеченные поля перед сохранением."
          />
        </div>
      )}
      {notice !== null && (
        <div style={{ marginTop: '12px' }}>
          <Callout variant="success" title="Готово" description={notice} />
        </div>
      )}
      {(context.warnings?.length ?? 0) > 0 && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="warning"
            title="Контекст сделки доступен частично"
            description="Opportunity или Company сейчас недоступны. Сохранённый состав КП загружен полностью."
          />
        </div>
      )}
      {!context.isEditable && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="neutral"
            title="КП доступно только для чтения"
            description="Редактирование разрешено только в статусах DRAFT и FAILED."
          />
        </div>
      )}

      <section style={styles.section}><h3 style={styles.sectionTitle}>Контекст сделки</h3><div style={styles.grid}><div><span style={styles.label}>Opportunity</span><div>{context.opportunity?.name ?? 'Не указана'}</div></div><div><span style={styles.label}>Прогноз сделки</span><div>{formatMoney(context.opportunity?.amount ?? null, context.opportunity?.currencyCode ?? null)}</div></div><div><span style={styles.label}>Компания</span><div>{context.company?.name ?? 'Компания не указана'}</div></div></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>Общие данные</h3><div style={styles.grid}>
        <Field label="Заголовок" value={state.header.title} disabled={!editable} onChange={(value) => setHeader('title', value)} error={validation.errors.title} />
        <Field label="Контакт" value={state.header.contactName ?? ''} disabled={!editable} onChange={(value) => setHeader('contactName', value)} />
        <Field label="Валюта" value={state.header.currencyCode ?? ''} disabled={!editable} onChange={(value) => setHeader('currencyCode', value.toUpperCase())} error={validation.errors.currencyCode} />
        <Field label="Срок действия, дней" type="number" value={String(state.header.validityDays)} disabled={!editable} onChange={(value) => setHeader('validityDays', Number(value))} error={validation.errors.validityDays} />
      </div><div style={{ marginTop: '10px' }}><Field label="Контекст и цель" value={state.header.contextAndGoal ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('contextAndGoal', value)} /></div></section>

      {context.legacySuggestion.canCreateStarterItem && state.items.length === 0 && !starterSuggestionDismissed && (
        <div style={{ marginTop: '16px' }}>
          <Callout
            variant="warning"
            title="КП создано в старом формате"
            description="Сохранение хотя бы одной позиции необратимо переведёт его на новую модель. Прежняя сумма сохранится, пока состав работ остаётся пустым."
          />
          <div style={{ ...styles.actions, marginTop: '8px' }}>
            <Button
              Icon={IconPlus}
              title="Создать стартовую строку"
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
              title="Начать с пустой таблицы"
              variant="tertiary"
              size="small"
              disabled={!editable}
              onClick={() => {
                setStarterSuggestionDismissed(true);
                setNotice('Добавьте первую строку вручную.');
              }}
            />
          </div>
        </div>
      )}

      {state.contentModelVersion === 'AGGREGATE_V2' && !aggregateReadyForGeneration && (state.status === 'DRAFT' || state.status === 'FAILED') && (
        <div style={{ marginTop: '12px' }}>
          <Callout
            variant="info"
            title="Документы пока нельзя сформировать"
            description="Добавьте минимум одну корректную позицию и один этап с результатом и сроком, сохраните изменения и убедитесь, что итог больше нуля."
          />
        </div>
      )}

      <section style={styles.section}>
        <div style={styles.header}>
          <h3 style={styles.sectionTitle}>Состав работ</h3>
          {editable && (
            <div style={styles.actions}>
              <Button
                Icon={IconPlus}
                title="Добавить из каталога"
                variant="secondary"
                size="small"
                onClick={() => setCatalogOpen((value) => !value)}
              />
              <Button
                Icon={IconPlus}
                title="Добавить строку"
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
                {['№', 'Источник', 'Блок', 'Наименование', 'Описание', 'Количество', 'Ед.', 'Ставка', 'Скидка, %', 'Сумма', 'Действия'].map((label) => (
                  <th key={label} style={styles.cell}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.items.map((item, index) => (
                <tr key={item.clientKey}>
                  <td style={styles.cell}>{index + 1}</td>
                  <td style={styles.cell}>{item.catalogItemId === null ? 'Вручную' : 'Каталог'}</td>
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
            <h3 style={styles.sectionTitle}>План работ</h3>
            <div style={styles.muted}>Результат и срок понадобятся перед формированием документа.</div>
          </div>
          {editable && (
            <Button
              Icon={IconPlus}
              title="Добавить этап"
              variant="secondary"
              size="small"
              onClick={() => edit((current) => ({ ...current, stages: [...current.stages, createEmptyStage()] }))}
            />
          )}
        </div>
        {state.stages.map((stage, index) => (
          <div key={stage.clientKey} style={{ ...styles.grid, marginBottom: '12px' }}>
            <Field label={`Этап ${index + 1}`} value={stage.title} disabled={!editable} onChange={(value) => updateStage(index, { title: value })} error={validation.errors[`stages.${index}.title`]} />
            <Field label="Результат" value={stage.result} disabled={!editable} onChange={(value) => updateStage(index, { result: value })} />
            <Field label="Срок" value={stage.duration} disabled={!editable} onChange={(value) => updateStage(index, { duration: value })} />
            <Field label="Описание" value={stage.description} disabled={!editable} onChange={(value) => updateStage(index, { description: value })} />
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

      <section style={styles.section}><h3 style={styles.sectionTitle}>Условия</h3><div style={styles.grid}><Field label="Условия оплаты" value={state.header.paymentTerms ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('paymentTerms', value)} /><Field label="Допущения" value={state.header.assumptions ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('assumptions', value)} /><Field label="Следующий шаг" value={state.header.nextStep ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('nextStep', value)} /></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>Итог</h3><strong>{formatMoney(preview, state.header.currencyCode)}</strong><div style={styles.muted}>Предварительный итог. После сохранения сервер возвращает каноническую сумму.</div></section>

      <div style={styles.sticky}>
        <div style={styles.muted}>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</div>
        {context.isEditable && (
          <div style={styles.actions}>
            <Button Icon={IconRefresh} title="Пересчитать" variant="tertiary" size="small" disabled={saving || generating} onClick={() => void recalculate()} />
            <Button
              title={confirmReset ? 'Подтвердить сброс' : 'Сбросить изменения'}
              variant="secondary"
              size="small"
              disabled={!dirty || saving || generating}
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  setNotice('Нажмите «Подтвердить сброс» для удаления локальных изменений.');
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
              title={saving ? 'Сохранение...' : 'Сохранить'}
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
