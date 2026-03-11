import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { DataGroupsClient } from './data-groups.client';
import { DataGroupRequest } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('DataGroupsClient', () => {
  let client: DataGroupsClient;
  let httpMock: HttpTestingController;

  const groupUrn = URN.parse('urn:data-source:group:xyz');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataGroupsClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(DataGroupsClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list data groups via GET /v1/data/groups', async () => {
    const promise = firstValueFrom(client.listDataGroups());

    const req = httpMock.expectOne('/v1/data/groups');
    expect(req.request.method).toBe('GET');

    req.flush({
      dataGroups: [
        {
          id: groupUrn.toString(),
          name: 'Core API',
          sources: [],
          metadata: {},
        },
      ],
    });

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeInstanceOf(URN);
    expect(result[0].name).toBe('Core API');
  });

  it('should create a data group via POST /v1/data/groups', async () => {
    const requestPayload: DataGroupRequest = {
      name: 'New Group',
      description: 'Test desc',
      sources: [{ dataSourceId: URN.parse('urn:data-source:bundle:1') }],
      metadata: { key: 'value' },
    };

    const promise = firstValueFrom(client.createDataGroup(requestPayload));

    const req = httpMock.expectOne('/v1/data/groups');
    expect(req.request.method).toBe('POST');

    // Validate that the request was serialized using strings, not raw URN objects
    expect(req.request.body).toEqual({
      name: 'New Group',
      description: 'Test desc',
      sources: [{ dataSourceId: 'urn:data-source:bundle:1' }],
      metadata: { key: 'value' },
    });

    req.flush({
      id: groupUrn.toString(),
      name: 'New Group',
      sources: [{ dataSourceId: 'urn:data-source:bundle:1' }],
      metadata: { key: 'value' },
    });

    const result = await promise;
    expect(result.id.equals(groupUrn)).toBe(true);
    expect(result.sources[0].dataSourceId).toBeInstanceOf(URN);
  });

  it('should update a data group via PUT /v1/data/groups/{id}', async () => {
    const requestPayload: DataGroupRequest = {
      name: 'Updated Group',
      sources: [],
    };

    const promise = firstValueFrom(
      client.updateDataGroup(groupUrn, requestPayload),
    );

    const req = httpMock.expectOne(
      '/v1/data/groups/urn%3Adata-source%3Agroup%3Axyz',
    );
    expect(req.request.method).toBe('PUT');

    req.flush({ id: groupUrn.toString(), name: 'Updated Group', sources: [] });

    const result = await promise;
    expect(result.name).toBe('Updated Group');
  });

  it('should delete a data group via DELETE /v1/data/groups/{id}', async () => {
    const promise = firstValueFrom(client.deleteDataGroup(groupUrn));

    const req = httpMock.expectOne(
      '/v1/data/groups/urn%3Adata-source%3Agroup%3Axyz',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await expect(promise).resolves.toBeUndefined();
  });
});
