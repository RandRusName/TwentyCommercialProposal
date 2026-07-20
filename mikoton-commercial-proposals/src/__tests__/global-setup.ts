import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appDevOnce, appUninstall } from 'twenty-sdk/cli';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type TestInstanceMode = 'ephemeral' | 'target';
type GuardedOperation = 'uninstall' | 'sync';

const APP_PATH = process.cwd();
const CONFIG_DIR = path.join(os.homedir(), '.twenty');
const REMOTE_NAME = 'local';
let didConfigureRemote = false;
let testInstanceMode: TestInstanceMode | null = null;

function getRequiredMode(): TestInstanceMode {
  const mode = process.env.TWENTY_TEST_INSTANCE_MODE;

  if (mode !== 'ephemeral' && mode !== 'target') {
    throw new Error(
      'TWENTY_TEST_INSTANCE_MODE must be set to "ephemeral" or "target"',
    );
  }

  return mode;
}

function getEnv(): { apiUrl: string; apiKey: string; mode: TestInstanceMode } {
  const mode = getRequiredMode();
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      'TWENTY_API_URL and TWENTY_API_KEY are required for integration tests',
    );
  }

  return { apiUrl, apiKey, mode };
}

function guardOperation(operation: GuardedOperation, mode: TestInstanceMode) {
  if (operation === 'uninstall' && mode !== 'ephemeral') {
    throw new Error(
      'App uninstall is forbidden outside an ephemeral test instance',
    );
  }

  if (operation === 'sync' && mode !== 'ephemeral') {
    throw new Error('App metadata sync is forbidden in target smoke mode');
  }
}

async function checkServer(apiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/healthz`);
  } catch {
    throw new Error(
      `Twenty server is not reachable at ${apiUrl}. ` +
        'Make sure the server is running before executing integration tests.',
    );
  }

  if (!response.ok) {
    throw new Error(`Server at ${apiUrl} returned ${response.status}`);
  }
}

function writeConfig(apiUrl: string, apiKey: string) {
  const payload = JSON.stringify(
    {
      version: 1,
      remotes: {
        [REMOTE_NAME]: { apiUrl, apiKey },
      },
      defaultRemote: REMOTE_NAME,
    },
    null,
    2,
  );

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONFIG_DIR, 'config.test.json'), payload);
}

type MetadataResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function metadataRequest<T>(
  apiUrl: string,
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${apiUrl}/metadata`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as MetadataResponse<T>;

  if (!response.ok || payload.data === undefined || payload.errors?.length) {
    throw new Error(
      payload.errors?.map(({ message }) => message).join('; ') ??
        `Metadata request failed with ${response.status}`,
    );
  }

  return payload.data;
}

async function configureEphemeralApplicationVariables(
  apiUrl: string,
  apiKey: string,
) {
  const documentServiceUrl = process.env.CI_DOCUMENT_SERVICE_URL;
  const documentServiceSecret = process.env.CI_DOCUMENT_SERVICE_SECRET;
  const internalApiUrl = process.env.TWENTY_APP_INTERNAL_API_URL;

  if (!documentServiceUrl || !documentServiceSecret || !internalApiUrl) {
    throw new Error(
      'CI document service and internal Twenty URL are required in ephemeral mode',
    );
  }

  const application = await metadataRequest<{
    findOneApplication: { id: string } | null;
  }>(
    apiUrl,
    apiKey,
    `query FindApplication($universalIdentifier: UUID!) {
      findOneApplication(
        universalIdentifier: $universalIdentifier
      ) { id }
    }`,
    { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
  );
  const applicationId = application.findOneApplication?.id;

  if (!applicationId) {
    throw new Error('Synced application was not found');
  }

  const values: Record<string, string> = {
    TWENTY_API_URL: internalApiUrl,
    DOCUMENT_SERVICE_URL: documentServiceUrl,
    DOCUMENT_SERVICE_SECRET: documentServiceSecret,
    TWENTY_FILE_UPLOAD_API_KEY: apiKey,
  };

  for (const [key, value] of Object.entries(values)) {
    await metadataRequest<{ updateOneApplicationVariable: boolean }>(
      apiUrl,
      apiKey,
      `mutation UpdateVariable($key: String!, $value: String!, $applicationId: UUID!) {
        updateOneApplicationVariable(
          key: $key
          value: $value
          applicationId: $applicationId
        )
      }`,
      { key, value, applicationId },
    );
  }
}

export async function setup() {
  const { apiUrl, apiKey, mode } = getEnv();
  testInstanceMode = mode;

  await checkServer(apiUrl);

  writeConfig(apiUrl, apiKey);
  didConfigureRemote = true;

  if (mode === 'target') {
    return;
  }

  guardOperation('uninstall', mode);
  await appUninstall({ appPath: APP_PATH }).catch(() => {});

  guardOperation('sync', mode);
  const result = await appDevOnce({
    appPath: APP_PATH,
    onProgress: (message: string) => console.log(`[dev] ${message}`),
  });

  if (!result.success) {
    throw new Error(
      `Dev sync failed: ${result.error?.message ?? 'Unknown error'}`,
    );
  }

  await configureEphemeralApplicationVariables(apiUrl, apiKey);
}

export async function teardown() {
  if (!didConfigureRemote || testInstanceMode !== 'ephemeral') {
    return;
  }

  guardOperation('uninstall', testInstanceMode);
  const uninstallResult = await appUninstall({ appPath: APP_PATH });

  if (!uninstallResult.success) {
    console.warn(
      `App uninstall failed: ${
        uninstallResult.error?.message ?? 'Unknown error'
      }`,
    );
  }
}
