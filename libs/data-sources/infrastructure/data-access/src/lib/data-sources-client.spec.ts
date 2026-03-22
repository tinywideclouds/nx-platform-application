import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { DataSourcesClient } from './data-sources.client';
import { DataSourceRequest } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('DataSourcesClient', () => {
  let client: DataSourcesClient;
  let httpMock: HttpTestingController;

  const targetUrn = URN.parse('urn:ingestiontarget:1');
  const dsUrn = URN.parse('urn:datasource:stream:abc');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataSourcesClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(DataSourcesClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list data sources via GET /v1/data/targets/{id}/sources', async () => {
    const promise = firstValueFrom(client.listDataSources(targetUrn));

    const req = httpMock.expectOne(
      '/v1/data/targets/urn%3Aingestiontarget%3A1/sources',
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      dataSources: [
        { id: dsUrn.toString(), name: 'Test Stream', rules_yaml: '' },
      ],
    });

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeInstanceOf(URN);
  });

  it('should create a data source via POST /v1/data/targets/{id}/sources', async () => {
    const requestPayload: DataSourceRequest = {
      name: 'Test',
      rulesYaml: 'include: *',
    };
    const promise = firstValueFrom(
      client.createDataSource(targetUrn, requestPayload),
    );

    const req = httpMock.expectOne(
      '/v1/data/targets/urn%3Aingestiontarget%3A1/sources',
    );
    expect(req.request.method).toBe('POST');

    req.flush({
      id: dsUrn.toString(),
      name: 'Test',
      rulesYaml: 'include: *',
    });

    const result = await promise;
    expect(result.id.equals(dsUrn)).toBe(true);
    expect(result.name).toBe('Test');
  });

  it('should update a data source via PUT /v1/data/targets/{id}/sources/{dataSourceId}', async () => {
    const requestPayload: DataSourceRequest = {
      name: 'Updated',
      rulesYaml: 'include: *',
    };
    const promise = firstValueFrom(
      client.updateDataSource(targetUrn, dsUrn, requestPayload),
    );

    const req = httpMock.expectOne(
      '/v1/data/targets/urn%3Aingestiontarget%3A1/sources/urn%3Adatasource%3Astream%3Aabc',
    );
    expect(req.request.method).toBe('PUT');

    req.flush({
      id: dsUrn.toString(),
      name: 'Updated',
      rulesYaml: 'include: *',
    });

    const result = await promise;
    expect(result.name).toBe('Updated');
  });

  it('should delete a data source via DELETE /v1/data/targets/{id}/sources/{dataSourceId}', async () => {
    const promise = firstValueFrom(client.deleteDataSource(targetUrn, dsUrn));

    const req = httpMock.expectOne(
      '/v1/data/targets/urn%3Aingestiontarget%3A1/sources/urn%3Adatasource%3Astream%3Aabc',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await expect(promise).resolves.toBeUndefined();
  });
});
