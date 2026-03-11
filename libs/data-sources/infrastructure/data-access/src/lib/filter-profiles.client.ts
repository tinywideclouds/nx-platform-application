import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  FilterProfile,
  ProfileRequest,
  serializeProfileRequest,
  deserializeFilterProfile,
  deserializeFilterProfileList,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class FilterProfilesClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  listProfiles(dataSourceId: URN): Observable<FilterProfile[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/profiles`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFilterProfileList));
  }

  createProfile(
    dataSourceId: URN,
    req: ProfileRequest,
  ): Observable<FilterProfile> {
    const bodyString = serializeProfileRequest(req);
    return this.http
      .post(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/profiles`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeFilterProfile));
  }

  updateProfile(
    dataSourceId: URN,
    profileId: URN,
    req: ProfileRequest,
  ): Observable<FilterProfile> {
    const bodyString = serializeProfileRequest(req);
    return this.http
      .put(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/profiles/${encodeURIComponent(profileId.toString())}`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeFilterProfile));
  }

  deleteProfile(dataSourceId: URN, profileId: URN): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/profiles/${encodeURIComponent(profileId.toString())}`,
    );
  }
}
