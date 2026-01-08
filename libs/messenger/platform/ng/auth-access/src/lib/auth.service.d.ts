import { Signal } from '@angular/core';
import { User } from '@nx-platform-application/platform-types';
import { Observable } from 'rxjs';
import * as i0 from "@angular/core";
export interface AuthStatusResponse {
    authenticated: boolean;
    user: User;
    token: string;
}
export declare abstract class IAuthService {
    abstract readonly currentUser: Signal<User | null>;
    abstract readonly isAuthenticated: Signal<boolean>;
    abstract readonly sessionLoaded$: Observable<AuthStatusResponse | null>;
    abstract getJwtToken(): string | null;
    abstract logout(): Observable<unknown>;
    abstract checkAuthStatus(): Observable<AuthStatusResponse | null>;
}
export declare class AuthService implements IAuthService {
    private http;
    private authApiUrl;
    readonly sessionLoaded$: Observable<AuthStatusResponse | null>;
    private _currentUser;
    private _jwt;
    currentUser: Signal<User | null>;
    isAuthenticated: Signal<boolean>;
    constructor();
    checkAuthStatus(): Observable<AuthStatusResponse | null>;
    logout(): Observable<Object>;
    getJwtToken(): string | null;
    private setAuthState;
    private clearAuthState;
    static ɵfac: i0.ɵɵFactoryDeclaration<AuthService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AuthService>;
}
