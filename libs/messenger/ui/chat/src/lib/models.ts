export type MessagePart =
  | { type: 'text'; content: string; ref?: string }
  | { type: 'link'; url: string }
  | { type: 'icon'; ref: string; color?: 'primary' | 'warn' | 'accent' };

export interface MessageAction {
  type: 'group-invite'; // Extensible union (e.g. | 'payment-request')
  actionMap: Record<string, string>;
  description?: string;
}

export interface DisplayMessage {
  id: string;
  kind: 'text' | 'image' | 'system' | 'action' | 'unknown';
  parts: MessagePart[];

  // Image-specific fields
  image?: {
    src: string;
    width: number;
    height: number;
    assets: any;
  };

  action?: MessageAction;
}
