import type { ChatEmote, MessagePart } from '../types/chat';

// In-memory caches for global and channel emotes
let globalEmotes: Map<string, ChatEmote> = new Map();
const channelEmotesCache: Map<string, Map<string, ChatEmote>> = new Map();
const channelIdCache: Map<string, string> = new Map(); // channelName -> twitchId

// Fetch FrankerFaceZ Global Emotes
async function fetchFFZGlobal(): Promise<ChatEmote[]> {
  try {
    const res = await fetch('https://api.frankerfacez.com/v1/set/global');
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    if (data.sets) {
      for (const setId in data.sets) {
        const set = data.sets[setId];
        if (set.emoticons) {
          for (const emo of set.emoticons) {
            emotes.push({
              name: emo.name,
              url: emo.urls['1'] || emo.urls['2'] || Object.values(emo.urls)[0] as string,
              provider: 'ffz'
            });
          }
        }
      }
    }
    return emotes;
  } catch (e) {
    console.error('Error fetching FFZ global emotes:', e);
    return [];
  }
}

// Fetch BetterTTV Global Emotes
async function fetchBTTVGlobal(): Promise<ChatEmote[]> {
  try {
    const res = await fetch('https://api.betterttv.net/3/cached/emotes/global');
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    if (Array.isArray(data)) {
      for (const emo of data) {
        emotes.push({
          name: emo.code,
          url: `https://cdn.betterttv.net/emote/${emo.id}/1x`,
          provider: 'bttv'
        });
      }
    }
    return emotes;
  } catch (e) {
    console.error('Error fetching BTTV global emotes:', e);
    return [];
  }
}

// Fetch 7TV Global Emotes
async function fetch7TVGlobal(): Promise<ChatEmote[]> {
  try {
    const res = await fetch('https://7tv.io/v3/emote-sets/global');
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    if (data && data.emotes) {
      for (const emo of data.emotes) {
        const hostUrl = emo.data?.host?.url || '';
        if (hostUrl) {
          emotes.push({
            name: emo.name,
            url: `https:${hostUrl}/1x.webp`,
            provider: '7tv'
          });
        }
      }
    }
    return emotes;
  } catch (e) {
    console.error('Error fetching 7TV global emotes:', e);
    return [];
  }
}

// Fetch and cache all global emotes
export async function loadGlobalEmotes(): Promise<void> {
  if (globalEmotes.size > 0) return;
  
  console.log('Loading global emotes...');
  const [ffz, bttv, sevens] = await Promise.all([
    fetchFFZGlobal(),
    fetchBTTVGlobal(),
    fetch7TVGlobal()
  ]);
  
  const tempMap = new Map<string, ChatEmote>();
  
  // Merge order: FFZ first, then BTTV, then 7TV (so 7TV overrides others if overlapping, which is standard user preference)
  ffz.forEach(e => tempMap.set(e.name, e));
  bttv.forEach(e => tempMap.set(e.name, e));
  sevens.forEach(e => tempMap.set(e.name, e));
  
  globalEmotes = tempMap;
  console.log(`Global emotes loaded. Total: ${globalEmotes.size}`);
}

// Resolve Channel Name to Twitch Broadcaster ID via FFZ Room API or ivr.fi
async function resolveChannelId(channelName: string): Promise<string | null> {
  const cleanName = channelName.toLowerCase().trim();
  if (channelIdCache.has(cleanName)) {
    return channelIdCache.get(cleanName) || null;
  }
  
  // 1. Try FrankerFaceZ Room API
  try {
    const res = await fetch(`https://api.frankerfacez.com/v1/room/${cleanName}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.room && data.room.twitch_id) {
        const twitchId = String(data.room.twitch_id);
        channelIdCache.set(cleanName, twitchId);
        return twitchId;
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
        const twitchId = String(users[0].id);
        channelIdCache.set(cleanName, twitchId);
        return twitchId;
      }
    }
  } catch (e) {
    console.error(`Error resolving channel ID for ${channelName}:`, e);
  }
  
  return null;
}

// Fetch Channel FFZ Emotes
async function fetchFFZChannel(channelName: string): Promise<ChatEmote[]> {
  try {
    const res = await fetch(`https://api.frankerfacez.com/v1/room/${channelName.toLowerCase().trim()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    if (data.sets) {
      for (const setId in data.sets) {
        const set = data.sets[setId];
        if (set.emoticons) {
          for (const emo of set.emoticons) {
            emotes.push({
              name: emo.name,
              url: emo.urls['1'] || emo.urls['2'] || Object.values(emo.urls)[0] as string,
              provider: 'ffz'
            });
          }
        }
      }
    }
    return emotes;
  } catch (e) {
    console.error(`Error fetching FFZ channel emotes for ${channelName}:`, e);
    return [];
  }
}

// Fetch Channel BTTV Emotes
async function fetchBTTVChannel(twitchId: string): Promise<ChatEmote[]> {
  try {
    const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${twitchId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    const allEmotes = [...(data.sharedEmotes || []), ...(data.channelEmotes || [])];
    for (const emo of allEmotes) {
      emotes.push({
        name: emo.code,
        url: `https://cdn.betterttv.net/emote/${emo.id}/1x`,
        provider: 'bttv'
      });
    }
    return emotes;
  } catch (e) {
    console.error(`Error fetching BTTV channel emotes for Twitch ID ${twitchId}:`, e);
    return [];
  }
}

// Fetch Channel 7TV Emotes
async function fetch7TVChannel(twitchId: string): Promise<ChatEmote[]> {
  try {
    const res = await fetch(`https://7tv.io/v3/users/twitch/${twitchId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const emotes: ChatEmote[] = [];
    
    const emoteSet = data.emote_set;
    if (emoteSet && emoteSet.emotes) {
      for (const emo of emoteSet.emotes) {
        const hostUrl = emo.data?.host?.url || '';
        if (hostUrl) {
          emotes.push({
            name: emo.name,
            url: `https:${hostUrl}/1x.webp`,
            provider: '7tv'
          });
        }
      }
    }
    return emotes;
  } catch (e) {
    console.error(`Error fetching 7TV channel emotes for Twitch ID ${twitchId}:`, e);
    return [];
  }
}

// Fetch and Cache Channel Emotes (FFZ, BTTV, 7TV)
export async function loadChannelEmotes(channelName: string): Promise<Map<string, ChatEmote>> {
  const cleanName = channelName.toLowerCase().trim();
  if (channelEmotesCache.has(cleanName)) {
    return channelEmotesCache.get(cleanName)!;
  }
  
  console.log(`Loading channel emotes for ${cleanName}...`);
  
  // First get FFZ emotes (which also resolves channel name -> twitch ID)
  const ffzEmotes = await fetchFFZChannel(cleanName);
  
  // Resolve twitch broadcaster ID
  const twitchId = await resolveChannelId(cleanName);
  
  let bttvEmotes: ChatEmote[] = [];
  let sevensEmotes: ChatEmote[] = [];
  
  if (twitchId) {
    // If we have a twitch ID, fetch BTTV and 7TV in parallel
    [bttvEmotes, sevensEmotes] = await Promise.all([
      fetchBTTVChannel(twitchId),
      fetch7TVChannel(twitchId)
    ]);
  }
  
  const channelMap = new Map<string, ChatEmote>();
  
  // Merge channel-specific emotes
  ffzEmotes.forEach(e => channelMap.set(e.name, e));
  bttvEmotes.forEach(e => channelMap.set(e.name, e));
  sevensEmotes.forEach(e => channelMap.set(e.name, e));
  
  channelEmotesCache.set(cleanName, channelMap);
  console.log(`Channel emotes loaded for ${cleanName}. Total: ${channelMap.size}`);
  
  return channelMap;
}

// Get Merged Emote Map (Global + Channel specific)
export function getEmoteMap(channelName: string): Map<string, ChatEmote> {
  const cleanName = channelName.toLowerCase().trim();
  const mergedMap = new Map<string, ChatEmote>(globalEmotes);
  
  const cEmotes = channelEmotesCache.get(cleanName);
  if (cEmotes) {
    cEmotes.forEach((v, k) => {
      mergedMap.set(k, v);
    });
  }
  
  return mergedMap;
}

interface TwitchEmotePosition {
  id: string;
  start: number;
  end: number;
}

// Parses a Twitch chat message, turning emotes (Twitch native, 7TV, BTTV, FFZ) and URLs into distinct message parts
export function parseMessage(
  messageText: string,
  channelName: string,
  emotesTag: string = '',
  settings: { enable7tv: boolean; enableBttv: boolean; enableFfz: boolean }
): MessagePart[] {
  // Step 1: Parse Twitch Native Emotes from tags
  const nativeEmotes: TwitchEmotePosition[] = [];
  if (emotesTag) {
    const parts = emotesTag.split('/');
    for (const part of parts) {
      const [emoteId, rangesStr] = part.split(':');
      if (emoteId && rangesStr) {
        const ranges = rangesStr.split(',');
        for (const range of ranges) {
          const [startStr, endStr] = range.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            nativeEmotes.push({ id: emoteId, start, end });
          }
        }
      }
    }
  }

  // Sort native emotes by starting position descending to process from the back
  nativeEmotes.sort((a, b) => b.start - a.start);

  interface RawPart {
    type: 'text';
    text: string;
    isNativeEmotePlace?: boolean;
    nativeEmoteId?: string;
  }

  // Slice message text into initial parts using native emote positions
  let rawParts: RawPart[] = [];
  let lastIndex = messageText.length;

  for (const emote of nativeEmotes) {
    // text after the emote
    if (emote.end + 1 < lastIndex) {
      rawParts.push({
        type: 'text',
        text: messageText.substring(emote.end + 1, lastIndex)
      });
    }
    // the emote itself
    rawParts.push({
      type: 'text',
      text: messageText.substring(emote.start, emote.end + 1),
      isNativeEmotePlace: true,
      nativeEmoteId: emote.id
    });
    lastIndex = emote.start;
  }

  // text before the first emote (or whole message if no emotes)
  if (lastIndex > 0) {
    rawParts.push({
      type: 'text',
      text: messageText.substring(0, lastIndex)
    });
  }

  // Reverse back to chronological order
  rawParts.reverse();

  // Get active 3rd-party emote maps
  const activeEmoteMap = getEmoteMap(channelName);

  const finalParts: MessagePart[] = [];

  for (const part of rawParts) {
    if (part.isNativeEmotePlace && part.nativeEmoteId) {
      finalParts.push({
        type: 'emote',
        emote: {
          name: part.text,
          url: `https://static-cdn.jtvnw.net/emoticons/v2/${part.nativeEmoteId}/default/dark/1.0`,
          provider: 'twitch'
        }
      });
    } else {
      // Process text part: check for third-party emotes and links
      const words = part.text.split(/(\s+)/); // Keep whitespace as tokens
      for (const token of words) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          finalParts.push({ type: 'text', content: token });
          continue;
        }

        // Check if token is a third-party emote
        const emote = activeEmoteMap.get(token);
        const isEnabled = 
          emote && 
          ((emote.provider === '7tv' && settings.enable7tv) ||
           (emote.provider === 'bttv' && settings.enableBttv) ||
           (emote.provider === 'ffz' && settings.enableFfz));

        if (emote && isEnabled) {
          finalParts.push({ type: 'emote', emote });
        } else if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(token)) {
          // Token is a URL
          finalParts.push({ type: 'link', url: token });
        } else {
          // Normal word
          finalParts.push({ type: 'text', content: token });
        }
      }
    }
  }

  // Merge contiguous text parts
  const mergedParts: MessagePart[] = [];
  for (const part of finalParts) {
    if (part.type === 'text') {
      const last = mergedParts[mergedParts.length - 1];
      if (last && last.type === 'text') {
        last.content += part.content;
      } else {
        mergedParts.push(part);
      }
    } else {
      mergedParts.push(part);
    }
  }

  return mergedParts;
}
