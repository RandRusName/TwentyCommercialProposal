export type CrmModuleCode =
  | 'foundation'
  | 'sales'
  | 'catalog'
  | 'documents'
  | 'commercial-proposals'
  | 'administration';

export type CrmModuleDefinition = {
  code: CrmModuleCode;
  version: string;
  dependencies: CrmModuleCode[];
  requiredCapabilities: string[];
};

export const CRM_MODULES: readonly CrmModuleDefinition[] = [
  { code: 'foundation', version: '1.0.0', dependencies: [], requiredCapabilities: ['twenty-core-api'] },
  { code: 'sales', version: '1.0.0', dependencies: ['foundation'], requiredCapabilities: ['company', 'person', 'opportunity'] },
  { code: 'catalog', version: '1.0.0', dependencies: ['foundation'], requiredCapabilities: ['custom-objects'] },
  { code: 'documents', version: '1.0.0', dependencies: ['foundation'], requiredCapabilities: ['document-service', 'object-storage'] },
  { code: 'commercial-proposals', version: '2.0.0', dependencies: ['foundation', 'sales', 'catalog', 'documents'], requiredCapabilities: ['logic-functions', 'front-components', 'files'] },
  { code: 'administration', version: '1.0.0', dependencies: ['foundation'], requiredCapabilities: ['application-variables', 'metadata-plan'] },
] as const;

export const getCrmModule = (code: CrmModuleCode) => {
  const module = CRM_MODULES.find((candidate) => candidate.code === code);
  if (module === undefined) throw new Error(`Unknown CRM module: ${code}`);
  return module;
};
