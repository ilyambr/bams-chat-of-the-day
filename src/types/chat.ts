export type SplitType = 'twitch-custom' | 'twitch-embed' | 'youtube-embed' | 'youtube-custom' | 'twitch-video' | 'youtube-video';

export interface Split {
  id: string;
  type: SplitType;
  channel: string;
}

export interface LayoutNode {
  id: string;
  type: 'split' | 'container';
  direction?: 'horizontal' | 'vertical';
  children?: LayoutNode[];
  splitId?: string;
}

export interface ChatBadge {
  name: string;
  url: string;
}

export interface ChatEmote {
  name: string;
  url: string;
  provider: 'twitch' | '7tv' | 'bttv' | 'ffz';
}

export interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  color: string;
  message: string; // Original raw message
  parts: MessagePart[]; // Parsed message parts (text, emotes, links)
  timestamp: string; // HH:MM
  badges: ChatBadge[];
  isHighlighted: boolean;
  isSystem?: boolean;
  emotesTag?: string;
}

export type MessagePart = 
  | { type: 'text'; content: string }
  | { type: 'emote'; emote: ChatEmote }
  | { type: 'link'; url: string };

export interface UserSettings {
  theme: 'dark' | 'black';
  fontSize: number; // in pixels, e.g. 14
  emoteSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
  showBadges: boolean;
  highlightWords: string[];
  enable7tv: boolean;
  enableBttv: boolean;
  enableFfz: boolean;
  maxMessages: number;
  startMerged: boolean;
}
