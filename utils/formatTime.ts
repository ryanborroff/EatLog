/** Formats an ISO timestamp as a local time-of-day, e.g. "7:32 PM". */
export const formatLoggedTime = (isoTimestamp: string): string =>
  new Date(isoTimestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
