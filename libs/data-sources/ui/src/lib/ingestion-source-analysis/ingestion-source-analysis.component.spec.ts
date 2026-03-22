import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngestionSourceAnalysisComponent } from './ingestion-source-analysis.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { DataSourceAnalysis } from '@nx-platform-application/data-sources-types';

describe('IngestionSourceAnalysisComponent', () => {
  let component: IngestionSourceAnalysisComponent;
  let fixture: ComponentFixture<IngestionSourceAnalysisComponent>;

  const mockAnalysis: DataSourceAnalysis = {
    totalFiles: 150,
    totalSizeBytes: 1536, // 1.5 KB
    extensions: { '.ts': 100, '.html': 50 },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngestionSourceAnalysisComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IngestionSourceAnalysisComponent);
    component = fixture.componentInstance;
  });

  it('should accurately format bytes into human-readable sizes', () => {
    expect(component.formatBytes(0)).toBe('0 B');
    expect(component.formatBytes(1024)).toBe('1 KB');
    expect(component.formatBytes(1536)).toBe('1.5 KB');
    expect(component.formatBytes(1048576)).toBe('1 MB');
  });

  it('should render the correct heading based on the sync status', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);

    // Test Unsynced State
    fixture.componentRef.setInput('status', 'unsynced');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ready for First Sync');

    // Test Synced/Ready State
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Repository Analysis');
  });

  it('should render the extension pills if provided', () => {
    fixture.componentRef.setInput('analysis', mockAnalysis);
    fixture.componentRef.setInput('status', 'ready');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('.ts: 100');
    expect(fixture.nativeElement.textContent).toContain('.html: 50');
  });
});
