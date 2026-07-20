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
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { EDIT_COMMERCIAL_PROPOSAL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type {
  RecalculateResult,
  SaveEditorRequest,
  SaveEditorResult,
} from 'src/domain/commercial-proposal-aggregate';
import {
  applyCanonicalResponse,
  buildSaveRequest,
  calculatePreview,
  createEmptyItem,
  createEmptyStage,
  createStarterItem,
  duplicateItem,
  duplicateStage,
  formatMoney,
  isEditorDirty,
  moveEntry,
  removeEntry,
  validateEditorState,
} from 'src/front-components/commercial-proposal-editor/editor-helpers';
import { getEditorStyles } from 'src/front-components/commercial-proposal-editor/editor-styles';
import type {
  EditorContextResponse,
  EditorItem,
  EditorStage,
  EditorState,
} from 'src/front-components/commercial-proposal-editor/editor-types';
import {
  AppRouteError,
  callAppRoute,
  isApplicationError,
} from 'src/front-components/utils/call-app-route';

const safeEditorError = (error: unknown) => {
  if (error instanceof AppRouteError) return error.message;
  return 'Не удалось выполнить операцию редактора. Обновите данные и повторите попытку.';
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
  const styles = getEditorStyles(useColorScheme());
  const proposalId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;
  const [context, setContext] = useState<EditorContextResponse | null>(null);
  const [canonical, setCanonical] = useState<EditorState | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [starterSuggestionDismissed, setStarterSuggestionDismissed] =
    useState(false);
  const pendingSave = useRef<SaveEditorRequest | null>(null);

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

  if (proposalId === null) return <div style={styles.root}>Выберите ровно одно коммерческое предложение.</div>;
  if (loading) return <div style={styles.root}>Загрузка коммерческого предложения...</div>;
  if (state === null || context === null) return <div style={styles.root}>{error ?? 'Не удалось загрузить КП.'}</div>;

  const setHeader = (key: keyof EditorState['header'], value: string | number | null) =>
    edit((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  const updateItem = (index: number, patch: Partial<EditorItem>) =>
    edit((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const updateStage = (index: number, patch: Partial<EditorStage>) =>
    edit((current) => ({ ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage) }));

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div><h2 style={styles.title}>Редактировать КП</h2><div style={styles.muted}>{state.number} · {state.status} · {state.contentModelVersion} · ревизия {state.editorRevision}</div></div>
        {!context.isEditable && <strong>Только чтение</strong>}
      </div>

      {error !== null && <div style={{ ...styles.error, marginTop: '12px' }}>{error}{conflict && <div style={{ marginTop: '8px' }}><button type="button" style={styles.button} onClick={() => void load()}>Загрузить актуальную версию</button><span style={{ marginLeft: '8px' }}>Локальные изменения остаются на экране до перезагрузки.</span></div>}</div>}
      {dirty && !validation.valid && <div style={{ ...styles.error, marginTop: '12px' }}>Исправьте отмеченные поля перед сохранением.</div>}
      {notice !== null && <div style={{ ...styles.success, marginTop: '12px' }}>{notice}</div>}
      {(context.warnings?.length ?? 0) > 0 && <div style={{ ...styles.banner, marginTop: '12px' }}>Часть справочного контекста Opportunity/Company сейчас недоступна. Состав КП загружен полностью.</div>}

      <section style={styles.section}><h3 style={styles.sectionTitle}>Контекст сделки</h3><div style={styles.grid}><div><span style={styles.label}>Opportunity</span><div>{context.opportunity?.name ?? 'Не указана'}</div></div><div><span style={styles.label}>Прогноз сделки</span><div>{formatMoney(context.opportunity?.amount ?? null, context.opportunity?.currencyCode ?? null)}</div></div><div><span style={styles.label}>Компания</span><div>{context.company?.name ?? 'Компания не указана'}</div></div></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>Общие данные</h3><div style={styles.grid}>
        <Field label="Заголовок" value={state.header.title} disabled={!editable} onChange={(value) => setHeader('title', value)} error={validation.errors.title} />
        <Field label="Контакт" value={state.header.contactName ?? ''} disabled={!editable} onChange={(value) => setHeader('contactName', value)} />
        <Field label="Валюта" value={state.header.currencyCode ?? ''} disabled={!editable} onChange={(value) => setHeader('currencyCode', value.toUpperCase())} error={validation.errors.currencyCode} />
        <Field label="Срок действия, дней" type="number" value={String(state.header.validityDays)} disabled={!editable} onChange={(value) => setHeader('validityDays', Number(value))} error={validation.errors.validityDays} />
      </div><div style={{ marginTop: '10px' }}><Field label="Контекст и цель" value={state.header.contextAndGoal ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('contextAndGoal', value)} /></div></section>

      {context.legacySuggestion.canCreateStarterItem && state.items.length === 0 && !starterSuggestionDismissed && <div style={{ ...styles.banner, marginTop: '16px' }}>У этого КП ещё нет состава работ. Можно создать стартовую строку из текущей суммы сделки.<div style={{ marginTop: '8px' }}><button type="button" style={styles.button} disabled={!editable} onClick={() => edit((current) => ({ ...current, items: [createStarterItem(context.legacySuggestion)] }))}>Создать стартовую строку</button><button type="button" style={{ ...styles.button, marginLeft: '8px' }} disabled={!editable} onClick={() => { setStarterSuggestionDismissed(true); setNotice('Добавьте первую строку вручную.'); }}>Начать с пустой таблицы</button></div></div>}

      <section style={styles.section}><div style={styles.header}><h3 style={styles.sectionTitle}>Состав работ</h3>{editable && <button type="button" style={styles.button} onClick={() => edit((current) => ({ ...current, items: [...current.items, createEmptyItem()] }))}>Добавить строку</button>}</div><div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['№','Блок','Наименование','Описание','Количество','Ед.','Ставка','Скидка, %','Сумма','Действия'].map((label) => <th key={label} style={styles.cell}>{label}</th>)}</tr></thead><tbody>{state.items.map((item, index) => <tr key={item.clientKey}><td style={styles.cell}>{index + 1}</td>{(['block','name','description','quantity','unit','unitPrice','discountPercent'] as const).map((key) => <td key={key} style={styles.cell}><input aria-label={`${key} ${index + 1}`} style={{ ...styles.input, width: key === 'description' ? '190px' : '100px' }} disabled={!editable} value={item[key]} onChange={(event) => updateItem(index, { [key]: event.target.value })} />{validation.errors[`items.${index}.${key}`] !== undefined && <div style={{ color: '#dc2626' }}>{validation.errors[`items.${index}.${key}`]}</div>}</td>)}<td style={styles.cell}>{formatMoney(calculatePreview({ ...state, items: [item] }), state.header.currencyCode)}</td><td style={styles.cell}><div style={styles.actions}>{editable && <><button type="button" title="Дублировать" aria-label="Дублировать строку" style={styles.button} onClick={() => edit((current) => ({ ...current, items: [...current.items.slice(0, index + 1), duplicateItem(item), ...current.items.slice(index + 1)] }))}>+</button><button type="button" title="Вверх" aria-label="Переместить строку вверх" style={styles.button} onClick={() => edit((current) => ({ ...current, items: moveEntry(current.items, index, -1) }))}>↑</button><button type="button" title="Вниз" aria-label="Переместить строку вниз" style={styles.button} onClick={() => edit((current) => ({ ...current, items: moveEntry(current.items, index, 1) }))}>↓</button><button type="button" title="Удалить" aria-label="Удалить строку" style={styles.button} onClick={() => edit((current) => ({ ...current, items: removeEntry(current.items, index) }))}>×</button></>}</div></td></tr>)}</tbody></table></div></section>

      <section style={styles.section}><div style={styles.header}><div><h3 style={styles.sectionTitle}>План работ</h3><div style={styles.muted}>Результат и срок понадобятся перед формированием документа.</div></div>{editable && <button type="button" style={styles.button} onClick={() => edit((current) => ({ ...current, stages: [...current.stages, createEmptyStage()] }))}>Добавить этап</button>}</div>{state.stages.map((stage, index) => <div key={stage.clientKey} style={{ ...styles.grid, marginBottom: '10px' }}><Field label={`Этап ${index + 1}`} value={stage.title} disabled={!editable} onChange={(value) => updateStage(index, { title: value })} error={validation.errors[`stages.${index}.title`]} /><Field label="Результат" value={stage.result} disabled={!editable} onChange={(value) => updateStage(index, { result: value })} /><Field label="Срок" value={stage.duration} disabled={!editable} onChange={(value) => updateStage(index, { duration: value })} /><Field label="Описание" value={stage.description} disabled={!editable} onChange={(value) => updateStage(index, { description: value })} /><div style={styles.actions}>{editable && <><button type="button" style={styles.button} onClick={() => edit((current) => ({ ...current, stages: [...current.stages.slice(0, index + 1), duplicateStage(stage), ...current.stages.slice(index + 1)] }))}>Дублировать</button><button type="button" aria-label="Переместить этап вверх" style={styles.button} onClick={() => edit((current) => ({ ...current, stages: moveEntry(current.stages, index, -1) }))}>↑</button><button type="button" aria-label="Переместить этап вниз" style={styles.button} onClick={() => edit((current) => ({ ...current, stages: moveEntry(current.stages, index, 1) }))}>↓</button><button type="button" style={styles.button} onClick={() => edit((current) => ({ ...current, stages: removeEntry(current.stages, index) }))}>Удалить</button></>}</div></div>)}</section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>Условия</h3><div style={styles.grid}><Field label="Условия оплаты" value={state.header.paymentTerms ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('paymentTerms', value)} /><Field label="Допущения" value={state.header.assumptions ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('assumptions', value)} /><Field label="Следующий шаг" value={state.header.nextStep ?? ''} disabled={!editable} multiline onChange={(value) => setHeader('nextStep', value)} /></div></section>

      <section style={styles.section}><h3 style={styles.sectionTitle}>Итог</h3><strong>{formatMoney(preview, state.header.currencyCode)}</strong><div style={styles.muted}>Предварительный итог. После сохранения сервер возвращает каноническую сумму.</div></section>

      <div style={styles.sticky}><div>{dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</div>{context.isEditable && <div style={styles.actions}><button type="button" style={styles.button} disabled={saving} onClick={() => void recalculate()}>Пересчитать</button><button type="button" style={styles.button} disabled={!dirty || saving} onClick={() => { if (!confirmReset) { setConfirmReset(true); setNotice('Нажмите «Сбросить изменения» ещё раз для подтверждения.'); return; } if (canonical !== null) setState(structuredClone(canonical)); setConfirmReset(false); setNotice(null); pendingSave.current = null; }}>Сбросить изменения</button><button type="button" style={{ ...styles.primary, opacity: !dirty || !validation.valid || saving ? 0.55 : 1 }} disabled={!dirty || !validation.valid || saving} onClick={() => void save()}>{saving ? 'Сохранение...' : 'Сохранить'}</button></div>}</div>
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
