export type CrmApplicationSettings = {
  defaultCurrency: string;
  businessTimezone: string;
  proposalNumberPrefix: string;
  proposalValidityDays: number;
  contractorName: string;
  contractorEmail: string;
  defaultLanguage: 'ru-RU' | 'en';
  enabledModules: string[];
};

export interface CrmApplicationSettingsProvider {
  get(): Promise<CrmApplicationSettings>;
}

export const COMPATIBILITY_SETTINGS_DEFAULTS: CrmApplicationSettings = {
  defaultCurrency: 'RUB',
  businessTimezone: 'Europe/Moscow',
  proposalNumberPrefix: 'КП-',
  proposalValidityDays: 14,
  contractorName: 'Шибеев Роман',
  contractorEmail: 'consulting@mikoton.ru',
  defaultLanguage: 'ru-RU',
  enabledModules: ['foundation', 'sales', 'catalog', 'documents', 'commercial-proposals', 'administration'],
};
