export const buildAppRouteUrl = (path: string) => {
  const appPath = `/s${path}`;
  const origin = globalThis.location?.origin;

  if (origin === undefined || origin === null || origin === '') {
    return appPath;
  }

  return new URL(appPath, origin).toString();
};

export const callAppRoute = async <TResponse extends object>(
  path: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(buildAppRouteUrl(path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
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
