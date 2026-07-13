import { getApplicationVariable } from 'twenty-sdk/front-component';

const APPLICATION_API_URL_VARIABLE = 'TWENTY_API_URL';
const TARGET_TWENTY_API_URL = 'http://192.168.100.11:3000';

const resolveHttpOrigin = (value: string | undefined) => {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  const candidate = value.startsWith('blob:') ? value.slice(5) : value;

  try {
    const url = new URL(candidate);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
};

const getFrontComponentApiOrigin = () =>
  resolveHttpOrigin(getApplicationVariable(APPLICATION_API_URL_VARIABLE)) ??
  resolveHttpOrigin(globalThis.location?.origin) ??
  resolveHttpOrigin(globalThis.location?.href) ??
  resolveHttpOrigin(String(globalThis.location ?? '')) ??
  resolveHttpOrigin(TARGET_TWENTY_API_URL);

const buildAppRouteHeaders = async () => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const requestToken =
    globalThis.frontComponentHostCommunicationApi?.requestAccessTokenRefresh;

  if (requestToken === undefined) {
    return headers;
  }

  const token = await requestToken();

  if (token !== '') {
    headers.authorization = `Bearer ${token}`;
  }

  return headers;
};

export const buildAppRouteUrl = (path: string) => {
  const appPath = `/s${path}`;
  const origin = getFrontComponentApiOrigin();

  if (origin === null) {
    throw new Error('Не удалось определить адрес Twenty для вызова app route');
  }

  return new URL(appPath, origin).toString();
};

export const callAppRoute = async <TResponse extends object>(
  path: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(buildAppRouteUrl(path), {
    method: 'POST',
    headers: await buildAppRouteHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as
    | TResponse
    | {
        error?: string | { code: string; message: string };
      };

  if (!response.ok) {
    if ('error' in payload && payload.error) {
      throw new Error(
        typeof payload.error === 'string'
          ? payload.error
          : payload.error.message,
      );
    }

    throw new Error(`App route failed with status ${response.status}`);
  }

  return payload as TResponse;
};
