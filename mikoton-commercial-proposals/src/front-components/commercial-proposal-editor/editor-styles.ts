import type { CSSProperties } from 'react';
import { THEME_DARK, THEME_LIGHT } from 'twenty-ui/theme';

export const getEditorStyles = (scheme: 'light' | 'dark') => {
  const theme = scheme === 'dark' ? THEME_DARK : THEME_LIGHT;
  const border = theme.border.color.light;
  const background = theme.background.primary;
  const muted = theme.font.color.secondary;

  return {
    root: { boxSizing: 'border-box', color: theme.font.color.primary, background, fontFamily: theme.font.family, minHeight: '100%', width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '20px 24px 96px' } satisfies CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' } satisfies CSSProperties,
    title: { margin: 0, fontSize: theme.font.size.xl, fontWeight: theme.font.weight.semiBold, lineHeight: 1.35 } satisfies CSSProperties,
    muted: { color: muted, fontSize: '12px', lineHeight: 1.45 } satisfies CSSProperties,
    section: { borderTop: `1px solid ${border}`, paddingTop: '14px', marginTop: '16px' } satisfies CSSProperties,
    sectionTitle: { margin: '0 0 10px', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semiBold } satisfies CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px' } satisfies CSSProperties,
    field: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 } satisfies CSSProperties,
    label: { color: muted, fontSize: '12px' } satisfies CSSProperties,
    input: { boxSizing: 'border-box', border: `1px solid ${border}`, borderRadius: theme.border.radius.sm, background: theme.background.secondary, color: theme.font.color.primary, padding: '8px', font: 'inherit', minWidth: 0, width: '100%' } satisfies CSSProperties,
    textarea: { boxSizing: 'border-box', border: `1px solid ${border}`, borderRadius: theme.border.radius.sm, background: theme.background.secondary, color: theme.font.color.primary, padding: '8px', font: 'inherit', minHeight: '72px', resize: 'vertical', width: '100%' } satisfies CSSProperties,
    tableWrap: { overflowX: 'auto', border: `1px solid ${border}`, borderRadius: '6px' } satisfies CSSProperties,
    table: { width: '100%', minWidth: '960px', borderCollapse: 'collapse', fontSize: '12px' } satisfies CSSProperties,
    cell: { borderBottom: `1px solid ${border}`, padding: '7px', verticalAlign: 'top' } satisfies CSSProperties,
    actions: { display: 'flex', gap: '4px', whiteSpace: 'nowrap' } satisfies CSSProperties,
    button: { border: `1px solid ${border}`, borderRadius: theme.border.radius.sm, background: theme.background.secondary, color: theme.font.color.primary, padding: '7px 10px', cursor: 'pointer', font: 'inherit' } satisfies CSSProperties,
    primary: { border: `1px solid ${theme.color.blue9}`, borderRadius: theme.border.radius.sm, background: theme.color.blue9, color: theme.font.color.inverted, padding: '8px 13px', cursor: 'pointer', fontWeight: theme.font.weight.semiBold } satisfies CSSProperties,
    banner: { border: `1px solid ${theme.border.color.medium}`, borderRadius: theme.border.radius.sm, background: theme.background.secondary, color: theme.font.color.primary, padding: '10px', fontSize: '13px', lineHeight: 1.45 } satisfies CSSProperties,
    error: { border: `1px solid ${theme.border.color.danger}`, borderRadius: theme.border.radius.sm, background: theme.background.danger, color: theme.font.color.danger, padding: '10px', fontSize: '13px' } satisfies CSSProperties,
    success: { border: `1px solid ${theme.color.green7}`, borderRadius: theme.border.radius.sm, background: theme.background.transparent.success, color: theme.color.green11, padding: '10px', fontSize: '13px' } satisfies CSSProperties,
    sticky: { position: 'sticky', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', borderTop: `1px solid ${border}`, background: theme.background.primary, padding: '12px 0', marginTop: '20px', zIndex: 2 } satisfies CSSProperties,
  };
};
