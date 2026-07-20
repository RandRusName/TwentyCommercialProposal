import type { CSSProperties } from 'react';

export const getEditorStyles = (scheme: 'light' | 'dark') => {
  const dark = scheme === 'dark';
  const border = dark ? '#374151' : '#d1d5db';
  const background = dark ? '#111827' : '#ffffff';
  const muted = dark ? '#9ca3af' : '#6b7280';

  return {
    root: { color: dark ? '#f9fafb' : '#111827', background, fontFamily: 'Inter, sans-serif', minHeight: '100%', padding: '16px 16px 88px' } satisfies CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' } satisfies CSSProperties,
    title: { margin: 0, fontSize: '18px', lineHeight: 1.35 } satisfies CSSProperties,
    muted: { color: muted, fontSize: '12px', lineHeight: 1.45 } satisfies CSSProperties,
    section: { borderTop: `1px solid ${border}`, paddingTop: '14px', marginTop: '16px' } satisfies CSSProperties,
    sectionTitle: { margin: '0 0 10px', fontSize: '14px' } satisfies CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' } satisfies CSSProperties,
    field: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 } satisfies CSSProperties,
    label: { color: muted, fontSize: '12px' } satisfies CSSProperties,
    input: { border: `1px solid ${border}`, borderRadius: '6px', background, color: dark ? '#f9fafb' : '#111827', padding: '8px', font: 'inherit', minWidth: 0 } satisfies CSSProperties,
    textarea: { border: `1px solid ${border}`, borderRadius: '6px', background, color: dark ? '#f9fafb' : '#111827', padding: '8px', font: 'inherit', minHeight: '72px', resize: 'vertical' } satisfies CSSProperties,
    tableWrap: { overflowX: 'auto', border: `1px solid ${border}`, borderRadius: '6px' } satisfies CSSProperties,
    table: { width: '100%', minWidth: '960px', borderCollapse: 'collapse', fontSize: '12px' } satisfies CSSProperties,
    cell: { borderBottom: `1px solid ${border}`, padding: '7px', verticalAlign: 'top' } satisfies CSSProperties,
    actions: { display: 'flex', gap: '4px', whiteSpace: 'nowrap' } satisfies CSSProperties,
    button: { border: `1px solid ${border}`, borderRadius: '6px', background, color: dark ? '#f9fafb' : '#111827', padding: '7px 10px', cursor: 'pointer', font: 'inherit' } satisfies CSSProperties,
    primary: { border: '1px solid #2563eb', borderRadius: '6px', background: '#2563eb', color: '#ffffff', padding: '8px 13px', cursor: 'pointer', fontWeight: 600 } satisfies CSSProperties,
    banner: { border: `1px solid ${dark ? '#854d0e' : '#fde68a'}`, borderRadius: '6px', background: dark ? '#422006' : '#fffbeb', color: dark ? '#fde68a' : '#713f12', padding: '10px', fontSize: '13px', lineHeight: 1.45 } satisfies CSSProperties,
    error: { border: `1px solid ${dark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '6px', background: dark ? '#450a0a' : '#fef2f2', color: dark ? '#fecaca' : '#991b1b', padding: '10px', fontSize: '13px' } satisfies CSSProperties,
    success: { border: `1px solid ${dark ? '#166534' : '#bbf7d0'}`, borderRadius: '6px', background: dark ? '#052e16' : '#f0fdf4', color: dark ? '#bbf7d0' : '#166534', padding: '10px', fontSize: '13px' } satisfies CSSProperties,
    sticky: { position: 'fixed', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', borderTop: `1px solid ${border}`, background, padding: '12px 16px', zIndex: 2 } satisfies CSSProperties,
  };
};
