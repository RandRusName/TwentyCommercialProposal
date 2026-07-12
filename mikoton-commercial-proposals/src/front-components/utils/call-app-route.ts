export const callAppRoute = async <TResponse extends object>(
  path: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(`/s${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TResponse | { error?: string };

  if (!response.ok) {
    throw new Error(
      'error' in payload && payload.error
        ? payload.error
        : `App route failed with status ${response.status}`,
    );
  }

  return payload as TResponse;
};
