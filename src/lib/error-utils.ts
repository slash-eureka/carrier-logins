/**
 * Safely extract error message from unknown error value
 * @param error - Unknown error value from catch block
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
