export interface IntegrationStatus {
  google: boolean;
  dropbox: boolean; // Future-proofing
}

export interface StorageOption {
  id: string;
  name: string;
}
