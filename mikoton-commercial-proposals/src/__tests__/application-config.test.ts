import {
  ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import defaultRole from 'src/default-role';
import { describe, expect, it } from 'vitest';

describe('application identifiers', () => {
  it('should expose the application metadata constants', () => {
    expect(APP_DISPLAY_NAME).toBeTruthy();
    expect(typeof APP_DESCRIPTION).toBe('string');
    expect(APPLICATION_UNIVERSAL_IDENTIFIER).toBeTruthy();
  });

  it('allows logic functions to attach generated files without broad object access', () => {
    expect(defaultRole.config.canUpdateAllObjectRecords).toBe(false);
    expect(defaultRole.config.objectPermissions).toContainEqual({
      objectUniversalIdentifier: ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    });
  });
});
