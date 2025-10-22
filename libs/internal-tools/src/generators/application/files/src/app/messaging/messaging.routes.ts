import { Routes } from '@angular/router';
import { MessagingComponent } from './messaging.component';

export const messagingRoutes: Routes = [
  {
    path: '', // Default route for the 'messaging' path
    component: MessagingComponent,
  },
];
