import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataGroup,
  DataGroupRequest,
  serializeDataGroupRequest,
  deserializeDataGroup,
  deserializeDataGroupList,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class DataGroupsClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  listDataGroups(): Observable<DataGroup[]> {
    return this.http
      .get(`${this.baseUrl}/v1/data/groups`, { responseType: 'text' })
      .pipe(map(deserializeDataGroupList));
  }

  createDataGroup(req: DataGroupRequest): Observable<DataGroup> {
    const bodyString = serializeDataGroupRequest(req);
    return this.http
      .post(`${this.baseUrl}/v1/data/groups`, bodyString, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text',
      })
      .pipe(map(deserializeDataGroup));
  }

  updateDataGroup(groupId: URN, req: DataGroupRequest): Observable<DataGroup> {
    const bodyString = serializeDataGroupRequest(req);
    return this.http
      .put(
        `${this.baseUrl}/v1/data/groups/${encodeURIComponent(groupId.toString())}`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeDataGroup));
  }

  deleteDataGroup(groupId: URN): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/v1/data/groups/${encodeURIComponent(groupId.toString())}`,
    );
  }
}
