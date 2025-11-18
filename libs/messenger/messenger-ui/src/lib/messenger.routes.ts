// libs/messenger/messenger-ui/src/lib/messenger.routes.ts

import { Routes } from '@angular/router';
import { MessengerHomePageComponent } from './messenger-home-page/messenger-home-page.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import { ChatConversationComponent } from './chat-conversation/chat-conversation.component';
// Use the WRAPPER, not the raw ContactDetailComponent
import { ChatContactDetailWrapperComponent } from './chat-contact-detail-wrapper/chat-contact-detail-wrapper.component';
import { URN } from '@nx-platform-application/platform-types';
import { ActivatedRouteSnapshot } from '@angular/router';

export const MESSENGER_ROUTES: Routes = [
  {
    path: '',
    component: MessengerHomePageComponent,
    children: [
      {
        path: 'chat/:id',
        component: ChatWindowComponent,
        children: [
          {
            path: '',
            component: ChatConversationComponent,
          },
          {
            path: 'details',
            component: ChatContactDetailWrapperComponent,
            resolve: {
              contactId: (route: ActivatedRouteSnapshot) => {
                 const id = route.parent?.paramMap.get('id');
                 return id ? URN.parse(id) : null;
              }
            }
          }
        ]
      }
    ]
  }
];