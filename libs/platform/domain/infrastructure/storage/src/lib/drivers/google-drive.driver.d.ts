import { VaultProvider, WriteOptions } from '../vault.provider';
import * as i0 from "@angular/core";
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}
export declare class GoogleDriveDriver implements VaultProvider {
    readonly providerId = "google";
    readonly displayName = "Google Drive";
    private logger;
    private config;
    private _isAuthenticated;
    private tokenClient;
    private gapiLoadedPromise;
    private gisLoadedPromise;
    private readonly DRIVE_SCOPE;
    private readonly DISCOVERY_DOC;
    private readonly ASSET_FOLDER;
    private readonly BOUNDARY;
    constructor();
    isAuthenticated(): boolean;
    link(persist: boolean): Promise<boolean>;
    unlink(): Promise<void>;
    writeJson(path: string, data: unknown, options?: WriteOptions): Promise<void>;
    readJson<T>(path: string): Promise<T | null>;
    fileExists(path: string): Promise<boolean>;
    listFiles(directory: string): Promise<string[]>;
    uploadPublicAsset(blob: Blob, filename: string): Promise<string>;
    private checkExistingSession;
    private ensureAuth;
    private parsePath;
    /**
     * Safe Folder Creation with Race Condition Handling
     */
    private ensureFolderHierarchy;
    private findFolderId;
    private getFileIdByName;
    private createFolder;
    private updateFile;
    private createFile;
    private createMultipartBody;
    private blobToBase64;
    private loadGapiScript;
    private initGapiClient;
    private loadGisScript;
    static ɵfac: i0.ɵɵFactoryDeclaration<GoogleDriveDriver, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<GoogleDriveDriver>;
}
