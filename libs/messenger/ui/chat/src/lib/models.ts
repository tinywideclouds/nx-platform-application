export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'link'; url: string };

export interface DisplayMessage {
  id: string;
  kind: 'text' | 'image' | 'system' | 'unknown'; // ✅ Added 'system'
  parts: MessagePart[];

  // Image-specific fields
  image?: {
    src: string;
    width: number;
    height: number;
    assets: any;
  };

  // ✅ System-specific fields
  system?: {
    text: string;
    icon: string;
    isAlert?: boolean; // For things like "Security code changed"
  };
}
