import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appDevOnce, appUninstall } from 'twenty-sdk/cli';

const APP_PATH = process.cwd();
const CONFIG_DIR = path.join(os.homedir(), '.twenty');
let didConfigureRemote = false;

function getEnv(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;
  const shouldRunRemoteSmoke = process.env.TWENTY_RUN_REMOTE_SMOKE === 'true';

  if (!shouldRunRemoteSmoke) {
    console.warn(
      'Skipping remote integration setup: set TWENTY_RUN_REMOTE_SMOKE=true to run it.',
    );
    return null;
  }

  if (!apiUrl || !apiKey) {
    console.warn(
      'Skipping remote integration setup: TWENTY_API_URL and TWENTY_API_KEY must be set.',
    );
    return null;
  }

  return { apiUrl, apiKey };
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
      remotes: {
        local: { apiUrl, apiKey, accessToken: apiKey },
      },
      defaultRemote: 'local',
    },
    null,
    2,
  );

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONFIG_DIR, 'config.test.json'), payload);
}

export async function setup() {
  const env = getEnv();

  if (env === null) {
    return;
  }

  const { apiUrl, apiKey } = env;

  await checkServer(apiUrl);

  writeConfig(apiUrl, apiKey);
  didConfigureRemote = true;

  await appUninstall({ appPath: APP_PATH }).catch(() => {});

  const result = await appDevOnce({
    appPath: APP_PATH,
    onProgress: (message: string) => console.log(`[dev] ${message}`),
  });

  if (!result.success) {
    throw new Error(
      `Dev sync failed: ${result.error?.message ?? 'Unknown error'}`,
    );
  }
}

export async function teardown() {
  if (!didConfigureRemote) {
    return;
  }

  const uninstallResult = await appUninstall({ appPath: APP_PATH });

  if (!uninstallResult.success) {
    console.warn(
      `App uninstall failed: ${uninstallResult.error?.message ?? 'Unknown error'}`,
    );
  }
}
