// Add specific error classes for high-signal reporting
export class EmptyGroupError extends Error {
  constructor(public groupUrn: string) {
    super(`Group ${groupUrn} is empty and cannot receive messages.`);
    this.name = 'EmptyGroupError';
  }
}

export class GroupNotFoundError extends Error {
  constructor(public groupUrn: string) {
    super(`Group ${groupUrn} was not found in the local database.`);
    this.name = 'GroupNotFoundError';
  }
}
