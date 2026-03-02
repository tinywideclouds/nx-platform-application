import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  LlmWorkspaceSidebarComponent,
  WorkspaceSidebarFile,
} from './workspace-sidebar.component';

describe('LlmWorkspaceSidebarComponent', () => {
  let component: LlmWorkspaceSidebarComponent;
  let fixture: ComponentFixture<LlmWorkspaceSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmWorkspaceSidebarComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(LlmWorkspaceSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should render the empty state when no files are provided', async () => {
    fixture.componentRef.setInput('files', []);
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No pending changes.');
  });

  it('should construct a proper tree and propagate warnings to folders', async () => {
    const mockFiles: WorkspaceSidebarFile[] = [
      {
        path: 'src/app/main.ts',
        name: 'main.ts',
        hasConflicts: true,
        hasPendingProposals: true,
      },
      {
        path: 'src/utils.ts',
        name: 'utils.ts',
        hasConflicts: false,
        hasPendingProposals: false,
      },
    ];

    fixture.componentRef.setInput('files', mockFiles);
    await fixture.whenStable();

    const rootNodes = component.tree();
    expect(rootNodes.length).toBe(1); // 'src' folder

    const srcFolder = rootNodes[0];
    expect(srcFolder.name).toBe('src');
    expect(srcFolder.isDirectory).toBe(true);
    expect(srcFolder.hasConflicts).toBe(true); // Propagated!

    expect(srcFolder.children.length).toBe(2);
    const appFolder = srcFolder.children.find((c) => c.name === 'app')!;
    const utilsFile = srcFolder.children.find((c) => c.name === 'utils.ts')!;

    expect(appFolder.isDirectory).toBe(true);
    expect(utilsFile.isDirectory).toBe(false);
  });

  it('should emit file selection when a file is clicked', async () => {
    const mockFiles: WorkspaceSidebarFile[] = [
      {
        path: 'main.ts',
        name: 'main.ts',
        hasConflicts: false,
        hasPendingProposals: false,
      },
    ];

    fixture.componentRef.setInput('files', mockFiles);
    await fixture.whenStable();

    let emittedPath: string | undefined;
    component.fileSelected.subscribe((path) => (emittedPath = path));

    const fileItem = fixture.debugElement.query(By.css('li'));
    fileItem.triggerEventHandler('click', new MouseEvent('click'));

    expect(emittedPath).toBe('main.ts');
  });

  it('should collapse a folder when clicked and not emit a file selection', async () => {
    const mockFiles: WorkspaceSidebarFile[] = [
      {
        path: 'src/main.ts',
        name: 'main.ts',
        hasConflicts: false,
        hasPendingProposals: false,
      },
    ];

    fixture.componentRef.setInput('files', mockFiles);
    await fixture.whenStable();

    let emittedPath: string | undefined;
    component.fileSelected.subscribe((path) => (emittedPath = path));

    // Find the 'src' folder li element
    const items = fixture.debugElement.queryAll(By.css('li'));
    const srcFolderItem = items[0];

    // Click the folder
    srcFolderItem.triggerEventHandler('click', new MouseEvent('click'));
    await fixture.whenStable();

    // Verify it collapsed (children shouldn't be rendered anymore)
    const newItems = fixture.debugElement.queryAll(By.css('li'));
    expect(newItems.length).toBe(1);
    expect(emittedPath).toBeUndefined();
  });
});
