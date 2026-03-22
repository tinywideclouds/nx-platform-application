import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { DataSourcesApiFacade } from '@nx-platform-application/data-sources-api';
import { LlmTargetProvider } from './llm-target.provider';

@Injectable({
  providedIn: 'root',
})
export class DataSourceTargetAdapter implements LlmTargetProvider {
  private readonly dataSourcesApi = inject(DataSourcesApiFacade);

  async getBaseFileContent(
    targetUrn: URN,
    filePath: string,
  ): Promise<string | null> {
    try {
      // We pass the request to the Data Sources boundary facade.
      // Note: In this adapter context, the 'targetUrn' provided by the LLM
      // workspace is expected to be a valid DataSource (Stream) URN.
      return await this.dataSourcesApi.getFileContent(targetUrn, filePath);
    } catch (error) {
      // If the API returns a 404 (file not found), it simply means the LLM
      // is proposing a brand new file that doesn't exist in the base tree yet.
      return null;
    }
  }
}
