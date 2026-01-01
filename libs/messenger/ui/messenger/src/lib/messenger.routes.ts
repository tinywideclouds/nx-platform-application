import { Routes, ActivatedRouteSnapshot } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';

// SHELL
import { MessengerHomePageComponent } from './messenger-home-page/messenger-home-page.component';

// FEATURE: CHAT
import { MessengerChatPageComponent } from './messenger-chat-page/messenger-chat-page.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import { ChatConversationComponent } from './chat-conversation/chat-conversation.component';
import { ChatContactDetailWrapperComponent } from './chat-contact-detail-wrapper/chat-contact-detail-wrapper.component';

export const messengerRoutes: Routes = [
  {
    path: '',
    component: MessengerHomePageComponent,
    children: [
      {
        path: '',
        redirectTo: 'conversations',
        pathMatch: 'full',
      },
      // === MAIN CHAT PAGE (Handles both List and New Chat modes via ?sidebar=new) ===
      {
        path: 'conversations',
        component: MessengerChatPageComponent,
        children: [
          {
            path: ':id',
            component: ChatWindowComponent,
            children: [
              { path: '', component: ChatConversationComponent },
              {
                path: 'details',
                component: ChatContactDetailWrapperComponent,
                resolve: {
                  contactId: (route: ActivatedRouteSnapshot) => {
                    const id = route.parent?.paramMap.get('id');
                    return id ? URN.parse(id) : null;
                  },
                },
              },
            ],
          },
        ],
      },
      // === REDIRECT LEGACY COMPOSE ===
      {
        path: 'compose',
        redirectTo: 'conversations?sidebar=new',
      },
      // === CONTACTS VIEWER (Standalone) ===
      {
        path: 'contacts',
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactsViewerComponent,
          ),
      },
      // === SETTINGS ===
      {
        path: 'settings',
        loadChildren: () =>
          import('@nx-platform-application/messenger-settings-ui').then(
            (m) => m.settingsRoutes,
          ),
      },
    ],
  },
];
