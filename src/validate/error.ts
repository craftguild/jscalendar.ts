/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
  path: string;

  /**
   * Create a new ValidationError.
   * @param path Validation path.
   * @param message Error message.
   */
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ValidationError";
    this.path = path;
  }
}

/**
 * Throw a ValidationError.
 * @param path Validation path.
 * @param message Error message.
 * @return Never returns.
 */
export function fail(path: string, message: string): never {
  throw new ValidationError(path, message);
}
