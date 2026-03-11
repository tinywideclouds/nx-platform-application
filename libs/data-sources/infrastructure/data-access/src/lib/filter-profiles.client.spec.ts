import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { FilterProfilesClient } from './filter-profiles.client';
import { ProfileRequest } from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('FilterProfilesClient', () => {
  let client: FilterProfilesClient;
  let httpMock: HttpTestingController;

  const dsUrn = URN.parse('urn:data-source:bundle:1');
  const profUrn = URN.parse('urn:data-source:profile:abc');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FilterProfilesClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(FilterProfilesClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list profiles via GET /v1/data/sources/{id}/profiles', async () => {
    const promise = firstValueFrom(client.listProfiles(dsUrn));

    const req = httpMock.expectOne(
      '/v1/data/sources/urn%3Adata-source%3Abundle%3A1/profiles',
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      profiles: [{ id: profUrn.toString(), name: 'Test', rulesYaml: '' }],
    });

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeInstanceOf(URN);
  });

  it('should create a profile via POST /v1/data/sources/{id}/profiles', async () => {
    const requestPayload: ProfileRequest = {
      name: 'Test',
      rulesYaml: 'include: *',
    };
    const promise = firstValueFrom(client.createProfile(dsUrn, requestPayload));

    const req = httpMock.expectOne(
      '/v1/data/sources/urn%3Adata-source%3Abundle%3A1/profiles',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(requestPayload);

    req.flush({
      id: profUrn.toString(),
      name: 'Test',
      rulesYaml: 'include: *',
    });

    const result = await promise;
    expect(result.id.equals(profUrn)).toBe(true);
    expect(result.name).toBe('Test');
  });

  it('should update a profile via PUT /v1/data/sources/{id}/profiles/{profileId}', async () => {
    const requestPayload: ProfileRequest = {
      name: 'Updated',
      rulesYaml: 'include: *',
    };
    const promise = firstValueFrom(
      client.updateProfile(dsUrn, profUrn, requestPayload),
    );

    const req = httpMock.expectOne(
      '/v1/data/sources/urn%3Adata-source%3Abundle%3A1/profiles/urn%3Adata-source%3Aprofile%3Aabc',
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(requestPayload);

    req.flush({
      id: profUrn.toString(),
      name: 'Updated',
      rulesYaml: 'include: *',
    });

    const result = await promise;
    expect(result.name).toBe('Updated');
  });

  it('should delete a profile via DELETE /v1/data/sources/{id}/profiles/{profileId}', async () => {
    const promise = firstValueFrom(client.deleteProfile(dsUrn, profUrn));

    const req = httpMock.expectOne(
      '/v1/data/sources/urn%3Adata-source%3Abundle%3A1/profiles/urn%3Adata-source%3Aprofile%3Aabc',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await expect(promise).resolves.toBeUndefined();
  });
});
