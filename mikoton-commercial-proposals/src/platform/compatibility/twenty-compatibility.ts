export const TWENTY_COMPATIBILITY = {
  minimumVersion: '2.20.0',
  maximumExclusiveVersion: '2.21.0',
  sdkVersion: '2.20.0',
  clientSdkVersion: '2.20.0',
  metadataSchemaVersion: '5.5',
} as const;

export const isSupportedTwentyVersion = (version: string) => {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (match === null) return false;

  const [, major, minor] = match.map(Number);
  return major === 2 && minor === 20;
};
