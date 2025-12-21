export class KeyNotFoundError extends Error {
  constructor(public urn: string) {
    super(`Public key not found for URN: ${urn}`);
    this.name = 'KeyNotFoundError';
    Object.setPrototypeOf(this, KeyNotFoundError.prototype);
  }
}
