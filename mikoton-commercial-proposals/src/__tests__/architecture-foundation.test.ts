import {
  COMPATIBILITY_SETTINGS_DEFAULTS,
} from 'src/modules/administration/application/crm-application-settings';
import {
  CRM_MODULES,
  getCrmModule,
} from 'src/modules/registry';
import {
  TWENTY_COMPATIBILITY,
  isSupportedTwentyVersion,
} from 'src/platform/compatibility/twenty-compatibility';
import { describe, expect, it } from 'vitest';

describe('CRM application architecture foundation', () => {
  it('registers every module once with resolvable dependencies', () => {
    const moduleCodes = CRM_MODULES.map(({ code }) => code);

    expect(new Set(moduleCodes).size).toBe(moduleCodes.length);
    for (const module of CRM_MODULES) {
      for (const dependency of module.dependencies) {
        expect(getCrmModule(dependency).code).toBe(dependency);
      }
    }
  });

  it('keeps commercial proposals dependent on ports owned by other modules', () => {
    expect(getCrmModule('commercial-proposals').dependencies).toEqual([
      'foundation',
      'sales',
      'catalog',
      'documents',
    ]);
    expect(getCrmModule('documents').dependencies).not.toContain(
      'commercial-proposals',
    );
  });

  it('accepts only the verified Twenty minor release', () => {
    expect(isSupportedTwentyVersion('v2.20.0')).toBe(true);
    expect(isSupportedTwentyVersion('2.20.0')).toBe(true);
    expect(isSupportedTwentyVersion('2.20.7')).toBe(true);
    expect(isSupportedTwentyVersion('2.19.9')).toBe(false);
    expect(isSupportedTwentyVersion('2.21.0')).toBe(false);
    expect(isSupportedTwentyVersion('not-a-version')).toBe(false);
    expect(TWENTY_COMPATIBILITY.sdkVersion).toBe('2.20.0');
  });

  it('enables exactly the registered modules by default', () => {
    expect(COMPATIBILITY_SETTINGS_DEFAULTS.enabledModules).toEqual(
      CRM_MODULES.map(({ code }) => code),
    );
  });
});
