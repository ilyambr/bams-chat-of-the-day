import type { ChatMessage, ChatBadge } from '../types/chat';
import { loadChannelEmotes } from './emotes';

type MessageCallback = (msg: ChatMessage) => void;

interface ChannelSubscription {
  callbacks: Set<MessageCallback>;
  joined: boolean;
}

// Static mapping for standard Twitch badges to bypass CORS and load instantly
const STANDARD_BADGES: Record<string, string> = {
  broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/552730c2-4d27-4a2d-a1ac-7cfbd421c501/1',
  moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1',
  vip: 'https://static-cdn.jtvnw.net/badges/v1/b817ad2e-19d4-4de1-82d0-2580c8d1d055/1',
  subscriber: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1', // Default subscriber star
  turbo: 'https://static-cdn.jtvnw.net/badges/v1/0599318a-dbf7-418b-bb66-b3136e0b4a95/1',
  premium: 'https://static-cdn.jtvnw.net/badges/v1/bbbe7311-1241-41d2-8b0e-4352000d97f3/1', // Prime Gaming
  artist: 'https://static-cdn.jtvnw.net/badges/v1/71ef28ed-d434-4061-be3d-6e8ff5f9e2cf/1',
  partner: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-a77b-a7cd2066cf99/1',
  staff: 'https://static-cdn.jtvnw.net/badges/v1/d97c37b1-af99-4c08-8f29-bf1a95ed3117/1',
  admin: 'https://static-cdn.jtvnw.net/badges/v1/9b51e40f-1b12-4f04-8c1c-6d00086c2e3a/1',
};

class TwitchIrcManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private isConnecting = false;
  private reconnectTimeout: number | null = null;
  private nickname = '';
  private channelBadgesCache: Map<string, Record<string, string>> = new Map(); // channel -> { badgeName: badgeUrl }
  private globalBadgesCache: Record<string, string> = {}; // { badgeName/version: url }

  constructor() {
    // Generate a random justinfan nick for anonymous reading
    const randomId = Math.floor(10000 + Math.random() * 90000);
    this.nickname = `justinfan${randomId}`;
    this.fetchGlobalBadges();
  }

  // Set up connection
  private connect() {
    if (this.ws || this.isConnecting) return;

    this.isConnecting = true;
    console.log('Connecting to Twitch IRC WebSocket...');
    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.ws.onopen = () => {
      console.log('Twitch IRC connection established.');
      this.isConnecting = false;
      
      // Request capability tags (very important for emotes, badges, and user-colors)
      this.ws?.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      this.ws?.send(`PASS SCHMESS`); // Pass can be anything for anonymous
      this.ws?.send(`NICK ${this.nickname}`);

      // Re-join any channels that were active
      this.subscriptions.forEach((_, channel) => {
        this.joinChannel(channel);
      });
    };

    this.ws.onmessage = (event) => {
      const messages = (event.data as string).split('\r\n');
      for (const rawMsg of messages) {
        if (rawMsg) this.handleIrcMessage(rawMsg);
      }
    };

    this.ws.onerror = (err) => {
      console.error('Twitch IRC WebSocket Error:', err);
    };

    this.ws.onclose = () => {
      console.warn('Twitch IRC WebSocket Closed. Attempting reconnect in 5s...');
      this.ws = null;
      this.isConnecting = false;
      this.subscriptions.forEach(sub => { sub.joined = false; });
      
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = window.setTimeout(() => this.connect(), 5000);
    };
  }

  private joinChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(`JOIN #${channel}`);
      const sub = this.subscriptions.get(channel);
      if (sub) sub.joined = true;
      console.log(`Sent JOIN command for channel: #${channel}`);
    }
  }

  private partChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(`PART #${channel}`);
      console.log(`Sent PART command for channel: #${channel}`);
    }
  }

  private async fetchGlobalBadges() {
    try {
      const res = await fetch('https://api.ivr.fi/v2/twitch/badges/global');
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.value)) {
        const globalBadges: Record<string, string> = {};
        for (const set of data.value) {
          const setName = set.set_id;
          if (Array.isArray(set.versions)) {
            for (const ver of set.versions) {
              const imgUrl = ver.image_url_1x;
              if (imgUrl) {
                globalBadges[`${setName}/${ver.id}`] = imgUrl;
                if (!globalBadges[setName]) {
                  globalBadges[setName] = imgUrl;
                }
              }
            }
          }
        }
        this.globalBadgesCache = globalBadges;
        console.log('Global Twitch badges loaded dynamically from ivr.fi.');
      }
    } catch (e) {
      console.warn('Could not load global badges dynamically:', e);
    }
  }

  public async resolveTwitchId(channelName: string): Promise<string | null> {
    const cleanName = channelName.toLowerCase().trim();
    
    // 1. Try FrankerFaceZ Room API
    try {
      const res = await fetch(`https://api.frankerfacez.com/v1/room/${cleanName}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.room && data.room.twitch_id) {
          return String(data.room.twitch_id);
        }
      }
    } catch (e) {
      console.warn(`FFZ ID resolve failed for ${cleanName}, trying ivr.fi...`, e);
    }
    
    // 2. Try ivr.fi API as fallback
    try {
      const res = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${cleanName}`);
      if (res.ok) {
        const data = await res.json();
        const users = Array.isArray(data) ? data : (data?.value || []);
        if (users[0] && users[0].id) {
          return String(users[0].id);
        }
      }
    } catch (e) {
      console.error(`ivr.fi ID resolve failed for ${cleanName}:`, e);
    }
    
    return null;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Subscribe to channel messages
  public subscribe(channel: string, callback: MessageCallback) {
    const cleanChannel = channel.toLowerCase().trim();
    if (!cleanChannel) return;

    if (!this.subscriptions.has(cleanChannel)) {
      this.subscriptions.set(cleanChannel, {
        callbacks: new Set([callback]),
        joined: false
      });
      // Asynchronously load channel emotes and badges when someone subscribes
      loadChannelEmotes(cleanChannel).then(() => {
        this.fetchChannelBadges(cleanChannel);
      });
      
      this.joinChannel(cleanChannel);
    } else {
      this.subscriptions.get(cleanChannel)!.callbacks.add(callback);
    }

    // Ensure we are connected
    this.connect();
  }

  // Unsubscribe from channel
  public unsubscribe(channel: string, callback: MessageCallback) {
    const cleanChannel = channel.toLowerCase().trim();
    const sub = this.subscriptions.get(cleanChannel);
    
    if (sub) {
      sub.callbacks.delete(callback);
      if (sub.callbacks.size === 0) {
        this.partChannel(cleanChannel);
        this.subscriptions.delete(cleanChannel);
      }
    }
  }

  // Parse Twitch badge tags (e.g. "badges=moderator/1,premium/1")
  private parseBadges(channel: string, badgesTag: string): ChatBadge[] {
    if (!badgesTag) return [];
    
    const parsed: ChatBadge[] = [];
    const list = badgesTag.split(',');
    
    for (const item of list) {
      const [name, version] = item.split('/');
      if (!name) continue;

      let url = '';
      
      // Check channel specific badge cache first (e.g. subscribers)
      const cBadges = this.channelBadgesCache.get(channel);
      if (cBadges && cBadges[`${name}/${version}`]) {
        url = cBadges[`${name}/${version}`];
      } else if (cBadges && cBadges[name]) {
        url = cBadges[name];
      } else if (this.globalBadgesCache[`${name}/${version}`]) {
        url = this.globalBadgesCache[`${name}/${version}`];
      } else if (this.globalBadgesCache[name]) {
        url = this.globalBadgesCache[name];
      } else if (STANDARD_BADGES[name]) {
        // Fallback to static URLs for standard badges
        url = STANDARD_BADGES[name];
      }

      if (url) {
        parsed.push({
          name: name,
          url: url
        });
      }
    }
    return parsed;
  }

  // Fetch channel-specific subscriber badges via public endpoint if available
  private async fetchChannelBadges(channelName: string) {
    try {
      const broadcasterId = await this.resolveTwitchId(channelName);
      if (!broadcasterId) return;
      
      // Fetch Twitch badges for channel from ivr.fi
      const badgeRes = await fetch(`https://api.ivr.fi/v2/twitch/badges/channel?id=${broadcasterId}`);
      if (!badgeRes.ok) return;
      const badgeData = await badgeRes.json();
      
      if (badgeData && Array.isArray(badgeData.value)) {
        const channelMap: Record<string, string> = {};
        
        for (const set of badgeData.value) {
          const setName = set.set_id;
          if (Array.isArray(set.versions)) {
            for (const ver of set.versions) {
              const imgUrl = ver.image_url_1x;
              if (imgUrl) {
                channelMap[`${setName}/${ver.id}`] = imgUrl;
              }
            }
          }
        }
        
        this.channelBadgesCache.set(channelName, channelMap);
        console.log(`Channel badges loaded for ${channelName} from ivr.fi`);
      }
    } catch (e) {
      console.warn(`Could not load custom badges for channel ${channelName}:`, e);
    }
  }

  // Process IRC message line
  private handleIrcMessage(raw: string) {
    // Keep socket alive
    if (raw.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv');
      return;
    }

    // Example line:
    // @badge-info=;badges=moderator/1;color=#00FF7F;display-name=User;emotes=;id=123-abc;mod=1;room-id=456;subscriber=0;tmi-sent-ts=1626500000000;user-id=789 :user!user@user.tmi.twitch.tv PRIVMSG #channel :hello world
    if (raw.startsWith('@')) {
      const spaceIdx = raw.indexOf(' ');
      if (spaceIdx === -1) return;

      const tagsSection = raw.substring(1, spaceIdx);
      const rest = raw.substring(spaceIdx + 1);

      if (rest.includes('PRIVMSG')) {
        const tags: Record<string, string> = {};
        const tagPairs = tagsSection.split(';');
        
        for (const pair of tagPairs) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx !== -1) {
            tags[pair.substring(0, eqIdx)] = pair.substring(eqIdx + 1);
          }
        }

        // Parse command and channel
        const privmsgIdx = rest.indexOf('PRIVMSG #');
        if (privmsgIdx === -1) return;

        const chanAndMsg = rest.substring(privmsgIdx + 9);
        const colIdx = chanAndMsg.indexOf(' :');
        if (colIdx === -1) return;

        const channel = chanAndMsg.substring(0, colIdx).toLowerCase().trim();
        const messageText = chanAndMsg.substring(colIdx + 2);

        const sub = this.subscriptions.get(channel);
        if (sub && sub.callbacks.size > 0) {
          // Parse values
          const displayName = tags['display-name'] || rest.substring(1, rest.indexOf('!'));
          const username = (rest.substring(1, rest.indexOf('!')) || displayName).toLowerCase();
          
          // Generate user color if not present
          let color = tags['color'] || '';
          if (!color) {
            const fallbackColors = ['#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'];
            // Simple hash from username to color index
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
              hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }
            color = fallbackColors[Math.abs(hash) % fallbackColors.length];
          }

          // Parse timestamps
          const sentTs = tags['tmi-sent-ts'] ? parseInt(tags['tmi-sent-ts'], 10) : Date.now();
          const date = new Date(sentTs);
          const timestamp = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

          const id = tags['id'] || `${sentTs}-${Math.random()}`;

          // Create message structure
          const chatMsg: ChatMessage = {
            id,
            username,
            displayName,
            color,
            message: messageText,
            timestamp,
            badges: this.parseBadges(channel, tags['badges']),
            parts: [], // will be set dynamically in the component based on user's current settings
            isHighlighted: false, // will be processed per-client based on highlight settings
            emotesTag: tags['emotes'] || ''
          };

          // Dispatch to callbacks
          sub.callbacks.forEach(cb => cb(chatMsg));
        }
      }
    }
  }
}

// Export singleton instance
export const twitchIrc = new TwitchIrcManager();
