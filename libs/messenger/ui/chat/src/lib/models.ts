export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'link'; url: string };

export interface DisplayMessage {
  id: string;
  kind: 'text' | 'image' | 'unknown';
  parts: MessagePart[];
  // Image-specific fields (only present if kind === 'image')
  image?: {
    src: string;
    width: number;
    height: number;
    assets: any; // Keep the asset record for HD upgrades
  };
}
