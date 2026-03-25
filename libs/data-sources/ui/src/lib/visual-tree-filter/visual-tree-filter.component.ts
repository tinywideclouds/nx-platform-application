import {
  Component,
  input,
  output,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlatTreeControl } from '@angular/cdk/tree';
import {
  MatTreeFlatDataSource,
  MatTreeFlattener,
  MatTreeModule,
} from '@angular/material/tree';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SelectionModel } from '@angular/cdk/collections';

import { FilterRules } from '@nx-platform-application/data-sources-types';

interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
}

interface FlatFileNode {
  expandable: boolean;
  name: string;
  path: string;
  level: number;
}

@Component({
  selector: 'visual-tree-filter',
  standalone: true,
  imports: [
    CommonModule,
    MatTreeModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './visual-tree-filter.component.html',
  styleUrl: './visual-tree-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualTreeFilterComponent {
  // MODERN ANGULAR: Signal inputs replace @Input + ngOnInit
  directories = input<string[]>([]);
  rulesChanged = output<FilterRules>();

  // Flat Tree Setup
  private transformer = (node: FileNode, level: number): FlatFileNode => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      path: node.path,
      level: level,
    };
  };

  treeControl = new FlatTreeControl<FlatFileNode>(
    (node) => node.level,
    (node) => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this.transformer,
    (node) => node.level,
    (node) => node.expandable,
    (node) => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  checklistSelection = new SelectionModel<FlatFileNode>(true);

  constructor() {
    // Rebuild tree whenever the directories array changes
    effect(() => {
      const dirs = this.directories();
      if (!dirs || dirs.length === 0) {
        this.dataSource.data = [];
        return;
      }

      const treeData = this.buildFileTree(dirs);
      this.dataSource.data = treeData;

      // Select all nodes by default
      this.treeControl.dataNodes.forEach((node) => {
        this.checklistSelection.select(node);
      });

      this.treeControl.expandAll();
      this.emitRules();
    });
  }

  hasChild = (_: number, node: FlatFileNode) => node.expandable;

  private buildFileTree(directories: string[]): FileNode[] {
    const root: FileNode[] = [];

    directories.forEach((path) => {
      const parts = path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let existingNode = currentLevel.find((n) => n.name === part);

        if (!existingNode) {
          existingNode = { name: part, path: currentPath, children: [] };
          currentLevel.push(existingNode);
        }

        currentLevel = existingNode.children!;
      });
    });

    return root;
  }

  // --- FLAT TREE SELECTION LOGIC ---

  descendantsAllSelected(node: FlatFileNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every((child) => this.checklistSelection.isSelected(child));
    return descAllSelected;
  }

  descendantsPartiallySelected(node: FlatFileNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some((child) =>
      this.checklistSelection.isSelected(child),
    );
    return result && !this.descendantsAllSelected(node);
  }

  todoItemSelectionToggle(node: FlatFileNode): void {
    this.checklistSelection.toggle(node);
    const descendants = this.treeControl.getDescendants(node);
    this.checklistSelection.isSelected(node)
      ? this.checklistSelection.select(...descendants)
      : this.checklistSelection.deselect(...descendants);

    this.checkAllParentsSelection(node);
    this.emitRules();
  }

  private checkAllParentsSelection(node: FlatFileNode): void {
    let parent: FlatFileNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  private checkRootNodeSelection(node: FlatFileNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every((child) => this.checklistSelection.isSelected(child));

    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  private getParentNode(node: FlatFileNode): FlatFileNode | null {
    const currentLevel = node.level;
    if (currentLevel < 1) {
      return null;
    }
    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;
    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];
      if (currentNode.level < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  private emitRules() {
    const excludes: string[] = [];

    // Only inspect the direct top-level nodes, and recurse down dynamically
    this.treeControl.dataNodes.forEach((node) => {
      // We only want to process rules starting from the root nodes
      if (node.level === 0) {
        this.traverseNodeForRules(node, excludes);
      }
    });

    this.rulesChanged.emit({
      include: ['**/*'],
      exclude: excludes,
    });
  }

  private traverseNodeForRules(node: FlatFileNode, excludes: string[]) {
    const isSelected = this.checklistSelection.isSelected(node);
    const isIndeterminate = this.descendantsPartiallySelected(node);

    if (!isSelected && !isIndeterminate) {
      excludes.push(`${node.path}/**`);
      return;
    }

    if (isIndeterminate) {
      const descendants = this.treeControl.getDescendants(node);
      // Find immediate children of this node
      const children = descendants.filter(
        (child) => child.level === node.level + 1,
      );
      children.forEach((child) => this.traverseNodeForRules(child, excludes));
    }
  }
}
