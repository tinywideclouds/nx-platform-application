import { Component, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MasterDetailLayoutComponent } from '../layouts/master-detail-layout.component';

@Component({
  selector: 'lib-demo-shell',
  standalone: true,
  // Make sure MasterDetailLayoutComponent is imported here!
  // If you put them in the same file, you don't need the import.
  imports: [MasterDetailLayoutComponent, RouterLink],
  template: `
    <div class="shell-header">
      <h2>Demo App</h2>
      <!-- Toggle to simulate Messenger vs Contacts App sizing -->
      <button (click)="toggleContainerSize()">
        {{ isConstrained() ? 'Switch to Full Screen' : 'Switch to Sidebar Mode' }}
      </button>
    </div>

    <!-- 
      THE CONTAINER 
      We toggle width here to prove the layout adapts without boolean inputs.
    -->
    <div class="layout-wrapper" [class.constrained]="isConstrained()">
      
      <lib-master-detail-layout [showDetail]="!!selectedId()">
        
        <!-- SLOT: SIDEBAR -->
        <div sidebar class="p-4">
          <div class="tabs">
            <a routerLink="." [queryParams]="{ tab: 'users' }" [class.active]="tab() === 'users'">Users</a>
            <a routerLink="." [queryParams]="{ tab: 'groups' }" [class.active]="tab() === 'groups'">Groups</a>
          </div>

          <ul class="list">
            @if (tab() === 'users') {
              @for (user of users; track user.id) {
                <li (click)="selectItem(user.id)" [class.selected]="selectedId() === user.id">
                  {{ user.name }}
                </li>
              }
            } @else {
              @for (group of groups; track group.id) {
                <li (click)="selectItem(group.id)" [class.selected]="selectedId() === group.id">
                  {{ group.name }}
                </li>
              }
            }
          </ul>
        </div>

        <!-- SLOT: MAIN -->
        <div main class="p-6 bg-gray-50 h-full">
          @if (selectedId()) {
            <div class="detail-card">
              <button class="back-btn" (click)="clearSelection()">← Back</button>
              <h1>{{ activeItem()?.name }}</h1>
              <p>ID: {{ activeItem()?.id }}</p>
              <p>Type: {{ tab() }}</p>
              <div class="fake-content"></div>
            </div>
          } @else {
            <div class="empty-state">
              Select an item from the {{ tab() }} list.
            </div>
          }
        </div>

      </lib-master-detail-layout>
    </div>
  `,
  styles: [`
    .shell-header { padding: 1rem; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; }
    
    /* SIMULATING ENVIRONMENTS */
    .layout-wrapper {
      height: calc(100vh - 70px);
      width: 100%;
      transition: width 0.3s ease;
      border: 1px solid #333;
      margin: 0 auto;
    }
    
    /* Simulates Messenger Sidebar or Mobile Device */
    .layout-wrapper.constrained {
      width: 380px; 
    }

    /* BASIC STYLING */
    .tabs { display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; }
    .tabs a { cursor: pointer; padding: 0.5rem; text-decoration: none; color: #666; }
    .tabs a.active { border-bottom: 2px solid blue; color: blue; font-weight: bold; }
    
    .list li { padding: 0.75rem; cursor: pointer; border-radius: 4px; }
    .list li:hover { background: #f0f0f0; }
    .list li.selected { background: #e0e7ff; color: blue; }

    .detail-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .fake-content { height: 200px; background: #f9f9f9; margin-top: 1rem; border-radius: 4px; }
    
    .back-btn { 
      display: none; /* Hidden by default (Desktop) */
      margin-bottom: 1rem; background: none; border: none; color: blue; cursor: pointer; font-weight: bold;
    }

    .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #999; }

    /* Show back button ONLY when we are in the constrained/stacked state */
    @container layout (max-width: 699px) {
      .back-btn { display: block; }
    }
  `]
})
export class DemoShellComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // --- STATE ---
  queryParams = toSignal(this.route.queryParamMap);
  
  tab = computed(() => this.queryParams()?.get('tab') || 'users');
  selectedId = computed(() => this.queryParams()?.get('selectedId'));

  // --- MOCK DATA ---
  users = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Charlie Davis' },
  ];
  
  groups = [
    { id: '101', name: 'Engineering Team' },
    { id: '102', name: 'Marketing Squad' },
  ];

  activeItem = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return [...this.users, ...this.groups].find(i => i.id === id);
  });

  // --- DEMO LAYOUT STATE ---
  // FIXED: Use standard signal import
  isConstrained = signal(false);

  toggleContainerSize() {
    // FIXED: Update signal directly
    this.isConstrained.update(v => !v);
  }

  // --- ACTIONS ---
  selectItem(id: string) {
    this.router.navigate([], {
      queryParams: { selectedId: id },
      queryParamsHandling: 'merge'
    });
  }

  clearSelection() {
    this.router.navigate([], {
      queryParams: { selectedId: null },
      queryParamsHandling: 'merge'
    });
  }
}