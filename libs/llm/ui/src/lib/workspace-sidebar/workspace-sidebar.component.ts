import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface WorkspaceSidebarFile {
  path: string;
  name: string;
  hasConflicts: boolean;
  hasPendingProposals: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string; // The full path to this node
  isDirectory: boolean;
  isExpanded: boolean;
  children: FileTreeNode[];
  hasConflicts: boolean;
  hasPendingProposals: boolean;
}

@Component({
  selector: 'llm-workspace-sidebar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './workspace-sidebar.component.html',
  styleUrl: './workspace-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmWorkspaceSidebarComponent {
  // --- INPUTS ---
  files = input.required<WorkspaceSidebarFile[]>();
  selectedFilePath = input<string | null>(null);

  // --- OUTPUTS ---
  fileSelected = output<string>();

  // --- INTERNAL STATE ---
  // We track collapsed folders. By default, everything is expanded so changes are visible.
  private collapsedFolders = signal<Set<string>>(new Set());

  // --- COMPUTED TREE ---
  tree = computed(() => {
    const root: FileTreeNode[] = [];
    const dirMap = new Map<string, FileTreeNode>();
    const collapsed = this.collapsedFolders();

    for (const file of this.files()) {
      const parts = file.path.split('/');
      let currentLevelList = root;
      let currentDirPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        currentDirPath = currentDirPath ? `${currentDirPath}/${part}` : part;

        if (isLast) {
          // Add the file
          currentLevelList.push({
            name: part,
            path: file.path,
            isDirectory: false,
            isExpanded: false,
            children: [],
            hasConflicts: file.hasConflicts,
            hasPendingProposals: file.hasPendingProposals,
          });
        } else {
          // Add or retrieve the directory
          if (!dirMap.has(currentDirPath)) {
            const newDir: FileTreeNode = {
              name: part,
              path: currentDirPath,
              isDirectory: true,
              isExpanded: !collapsed.has(currentDirPath),
              children: [],
              hasConflicts: false,
              hasPendingProposals: false,
            };
            dirMap.set(currentDirPath, newDir);
            currentLevelList.push(newDir);
          }

          const dir = dirMap.get(currentDirPath)!;
          // Propagate warnings up to the folder level
          if (file.hasConflicts) dir.hasConflicts = true;
          if (file.hasPendingProposals) dir.hasPendingProposals = true;

          currentLevelList = dir.children;
        }
      }
    }

    // Sort folders first, then files alphabetically
    this.sortTree(root);
    return root;
  });

  // --- ACTIONS ---

  onSelectNode(node: FileTreeNode, event: Event): void {
    event.stopPropagation();

    if (node.isDirectory) {
      this.toggleFolder(node.path);
    } else {
      this.fileSelected.emit(node.path);
    }
  }

  toggleFolder(dirPath: string): void {
    this.collapsedFolders.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(dirPath)) {
        newSet.delete(dirPath);
      } else {
        newSet.add(dirPath);
      }
      return newSet;
    });
  }

  // --- UTILS ---

  private sortTree(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
    for (const node of nodes) {
      if (node.isDirectory) {
        this.sortTree(node.children);
      }
    }
  }
}
