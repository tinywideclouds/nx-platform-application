import { Routes, ActivatedRouteSnapshot } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';

// SHELL
import { MessengerHomePageComponent } from './messenger-home-page/messenger-home-page.component';

// FEATURE: CHAT / CONVERSATIONS (State 1)
import { MessengerChatPageComponent } from './messenger-chat-page/messenger-chat-page.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import { ChatConversationComponent } from './chat-conversation/chat-conversation.component';
import { ChatContactDetailWrapperComponent } from './chat-contact-detail-wrapper/chat-contact-detail-wrapper.component';

// FEATURE: COMPOSE (State 2)
import { MessengerComposePageComponent } from './messenger-compose-page/messenger-compose-page.component';

export const MESSENGER_ROUTES: Routes = [
  {
    path: '',
    component: MessengerHomePageComponent,
    children: [
      {
        path: '',
        redirectTo: 'conversations',
        pathMatch: 'full'
      },

      // === STATE 1: CONVERSATIONS ===
      {
        path: 'conversations',
        component: MessengerChatPageComponent, // Sidebar: Conversation List
        children: [
          {
            path: ':id',
            component: ChatWindowComponent, // Main: Header + Outlet
            children: [
              {
                path: '',
                component: ChatConversationComponent // Content: Bubbles + Input
              },
              {
                path: 'details',
                component: ChatContactDetailWrapperComponent, // Content: Contact Info
                resolve: {
                  contactId: (route: ActivatedRouteSnapshot) => {
                    // Resolve ID from parent (:id) for the details view
                    const id = route.parent?.paramMap.get('id');
                    return id ? URN.parse(id) : null;
                  }
                }
              }
            ]
          }
        ]
      },

      // === STATE 2: COMPOSE ===
      {
        path: 'compose',
        component: MessengerComposePageComponent // Sidebar: Contacts Select, Main: Placeholder
      },

      // === STATE 3: CONTACTS ===
      {
        path: 'contacts',
        // Lazy load the reusable component from contacts-ui
        loadComponent: () => 
          import('@nx-platform-application/contacts-ui').then(m => m.ContactsViewerComponent)
      }
    ]
  }
];