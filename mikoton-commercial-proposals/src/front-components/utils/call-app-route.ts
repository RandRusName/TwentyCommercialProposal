import { RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { getApplicationVariable } from 'twenty-sdk/front-component';

const APPLICATION_API_URL_VARIABLE = 'TWENTY_API_URL';
const APPLICATION_FUNCTIONS_URL_VARIABLE = 'TWENTY_FUNCTIONS_URL';
const TARGET_TWENTY_API_URL = 'http://192.168.100.11:3000';

export type AppRouteErrorCode =
  | 'APP_TOKEN_API_UNAVAILABLE'
  | 'APP_TOKEN_REFRESH_FAILED'
  | 'APP_TOKEN_EMPTY'
  | 'APP_ROUTE_NETWORK_ERROR'
  | 'APP_ROUTE_FORBIDDEN'
  | 'APP_ROUTE_UNAUTHORIZED'
  | 'APP_ROUTE_INVALID_RESPONSE'
  | 'APP_ROUTE_APPLICATION_ERROR';

type AppRouteDiagnostic = {
  routeUrl: string;
  refreshApiAvailable: boolean;
  tokenReceived: boolean;
  tokenLength: number;
  responseStatus?: number;
  responseStatusText?: string;
  responseBodyPresent?: boolean;
};

type AppRouteFailurePayload = {
  error?: string | { code?: string; message?: string };
};

const APP_ROUTE_AUTH_MESSAGE =
  'Не удалось авторизовать запрос приложения.\nОбновите страницу и повторите попытку.';

export class AppRouteError extends Error {
  constructor(
    readonly code: AppRouteErrorCode,
    message: string,
    readonly diagnostic: AppRouteDiagnostic,
  ) {
    super(message);
    this.name = 'AppRouteError';
  }
}

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
  resolveHttpOrigin(process.env.TWENTY_API_URL) ??
  resolveHttpOrigin(getApplicationVariable(APPLICATION_API_URL_VARIABLE)) ??
  resolveHttpOrigin(globalThis.location?.origin) ??
  resolveHttpOrigin(globalThis.location?.href) ??
  resolveHttpOrigin(String(globalThis.location ?? '')) ??
  resolveHttpOrigin(TARGET_TWENTY_API_URL);

const getInitialApplicationAccessToken = () => {
  const token = process.env.TWENTY_APP_ACCESS_TOKEN;

  if (token === undefined || token.trim() === '') {
    return null;
  }

  return token;
};

const getFrontComponentFunctionsBaseUrl = () =>
  process.env.TWENTY_FUNCTIONS_URL ??
  getApplicationVariable(APPLICATION_FUNCTIONS_URL_VARIABLE);

export const buildAppRouteUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const functionsBaseUrl = getFrontComponentFunctionsBaseUrl();

  if (functionsBaseUrl !== undefined && functionsBaseUrl.trim() !== '') {
    return `${functionsBaseUrl.replace(/\/$/, '')}${normalizedPath}`;
  }

  const appPath = `/s${normalizedPath}`;
  const origin = getFrontComponentApiOrigin();

  if (origin === null) {
    throw new Error(
      'Не удалось определить адрес Twenty для вызова app route',
    );
  }

  return new URL(appPath, origin).toString();
};

const logRouteDiagnostic = (
  message: string,
  diagnostic: AppRouteDiagnostic,
) => {
  console.info('commercial-proposal app route diagnostic', {
    message,
    routeUrl: diagnostic.routeUrl,
    refreshApiAvailable: diagnostic.refreshApiAvailable,
    tokenReceived: diagnostic.tokenReceived,
    tokenLength: diagnostic.tokenLength,
    responseStatus: diagnostic.responseStatus,
    responseStatusText: diagnostic.responseStatusText,
    responseBodyPresent: diagnostic.responseBodyPresent,
  });
};

const throwAppRouteError = (
  code: AppRouteErrorCode,
  message: string,
  diagnostic: AppRouteDiagnostic,
): never => {
  logRouteDiagnostic(code, diagnostic);
  throw new AppRouteError(code, message, diagnostic);
};

const getStructuredErrorMessage = (payload: object | null) => {
  if (payload === null || !('error' in payload)) {
    return null;
  }

  const error = (payload as AppRouteFailurePayload).error;

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error?.message === 'string') {
    return error.message;
  }

  return null;
};

const getApplicationAccessToken = async (diagnostic: AppRouteDiagnostic) => {
  const initialToken = getInitialApplicationAccessToken();

  if (initialToken !== null) {
    diagnostic.tokenReceived = true;
    diagnostic.tokenLength = initialToken.length;

    return initialToken;
  }

  const requestToken =
    globalThis.frontComponentHostCommunicationApi?.requestAccessTokenRefresh;

  if (requestToken === undefined) {
    return throwAppRouteError(
      'APP_TOKEN_API_UNAVAILABLE',
      APP_ROUTE_AUTH_MESSAGE,
      diagnostic,
    );
  }

  diagnostic.refreshApiAvailable = true;

  const token = await requestToken().catch(() =>
    throwAppRouteError(
      'APP_TOKEN_REFRESH_FAILED',
      APP_ROUTE_AUTH_MESSAGE,
      diagnostic,
    ),
  );

  diagnostic.tokenReceived = token !== '';
  diagnostic.tokenLength = token.length;

  if (token === '') {
    return throwAppRouteError(
      'APP_TOKEN_EMPTY',
      APP_ROUTE_AUTH_MESSAGE,
      diagnostic,
    );
  }

  return token;
};

const splitRouteUrl = (routeUrl: string) => {
  const parsedUrl = new URL(routeUrl);

  return {
    baseUrl: parsedUrl.origin,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
  };
};

const isObjectPayload = (payload: unknown): payload is object =>
  typeof payload === 'object' && payload !== null && !Array.isArray(payload);

export const callAppRoute = async <TResponse extends object>(
  path: string,
  body: Record<string, unknown>,
) => {
  const routeUrl = buildAppRouteUrl(path);
  const diagnostic: AppRouteDiagnostic = {
    routeUrl,
    refreshApiAvailable: false,
    tokenReceived: false,
    tokenLength: 0,
  };

  const token = await getApplicationAccessToken(diagnostic);
  const { baseUrl, path: routePath } = splitRouteUrl(routeUrl);
  const client = new RestApiClient({ baseUrl, token });

  let payload: unknown;

  try {
    payload = await client.post(routePath, body);
    diagnostic.responseStatus = 200;
    diagnostic.responseStatusText = '';
    diagnostic.responseBodyPresent = payload !== undefined;
  } catch (error) {
    if (!(error instanceof RestApiClientError)) {
      return throwAppRouteError(
        'APP_ROUTE_NETWORK_ERROR',
        'Не удалось выполнить запрос приложения. Проверьте сеть и повторите попытку.',
        diagnostic,
      );
    }

    diagnostic.responseStatus = error.status;
    diagnostic.responseStatusText = error.statusText;
    diagnostic.responseBodyPresent = error.body !== undefined;

    const errorPayload = isObjectPayload(error.body) ? error.body : null;

    if (error.status === 401) {
      return throwAppRouteError(
        'APP_ROUTE_UNAUTHORIZED',
        APP_ROUTE_AUTH_MESSAGE,
        diagnostic,
      );
    }

    if (error.status === 403) {
      return throwAppRouteError(
        'APP_ROUTE_FORBIDDEN',
        APP_ROUTE_AUTH_MESSAGE,
        diagnostic,
      );
    }

    const structuredMessage = getStructuredErrorMessage(errorPayload);

    if (structuredMessage !== null) {
      return throwAppRouteError(
        'APP_ROUTE_APPLICATION_ERROR',
        structuredMessage,
        diagnostic,
      );
    }

    if (typeof error.body === 'string') {
      return throwAppRouteError(
        'APP_ROUTE_INVALID_RESPONSE',
        'App route returned a non-JSON response',
        diagnostic,
      );
    }

    return throwAppRouteError(
      'APP_ROUTE_INVALID_RESPONSE',
      `App route failed: ${error.status ?? 'unknown'} ${
        error.statusText ?? ''
      }`.trim(),
      diagnostic,
    );
  }

  if (!isObjectPayload(payload)) {
    throwAppRouteError(
      'APP_ROUTE_INVALID_RESPONSE',
      payload === undefined
        ? 'App route returned an empty response'
        : 'App route returned a non-JSON response',
      diagnostic,
    );
  }

  logRouteDiagnostic('APP_ROUTE_SUCCESS', diagnostic);

  return payload as TResponse;
};
