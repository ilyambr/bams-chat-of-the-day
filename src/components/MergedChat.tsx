import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Split, LayoutNode, UserSettings, ChatBadge, MessagePart } from '../types/chat';
import { twitchIrc } from '../services/twitchIrc';
import { parseMessage, loadChannelEmotes } from '../services/emotes';
import {
  resolveYoutubeChannelToVideoId,
  resolveInitialChatData,
  pollYoutubeChat,
  parseYoutubeActions,
} from '../services/youtubeChat';
import type { YoutubeChatMessage } from '../services/youtubeChat';

interface MergedMessage {
  id: string;
  source: 'twitch' | 'youtube';
  channel: string;
  displayName: string;
  userColor: string;
  parts: MessagePart[];
  timestamp: string;
  badges: ChatBadge[];
  avatarUrl?: string;
}

// Stable per-channel accent colors for the source badge
const CHANNEL_COLORS = [
  '#818cf8', '#34d399', '#fb923c', '#f472b6',
  '#38bdf8', '#a78bfa', '#facc15', '#4ade80',
];

function getChannelAccent(index: number): string {
  return CHANNEL_COLORS[index % CHANNEL_COLORS.length];
}

// Helper to recursively collect all split IDs currently in the layout tree
function getActiveSplitIds(node: LayoutNode): string[] {
  if (node.type === 'split') {
    return node.splitId ? [node.splitId] : [];
  }
  if (node.type === 'container' && node.children) {
    return node.children.flatMap(getActiveSplitIds);
  }
  return [];
}

const getFallbackBadgeUrl = (name: string): string => {
  const norm = name.toLowerCase();
  switch (norm) {
    case 'moderator':
      return 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1';
    case 'broadcaster':
      return 'https://static-cdn.jtvnw.net/badges/v1/552730c2-4d27-4a2d-a1ac-7cfbd421c501/1';
    case 'vip':
      return 'https://static-cdn.jtvnw.net/badges/v1/b817ad2e-19d4-4de1-82d0-2580c8d1d055/1';
    case 'subscriber':
      return 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1';
    case 'premium':
      return 'https://static-cdn.jtvnw.net/badges/v1/bbbe7311-1241-41d2-8b0e-4352000d97f3/1';
    case 'turbo':
      return 'https://static-cdn.jtvnw.net/badges/v1/0599318a-dbf7-418b-bb66-b3136e0b4a95/1';
    case 'partner':
      return 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-a77b-a7cd2066cf99/1';
    default:
      return '';
  }
};

interface MergedChatProps {
  splits: Record<string, Split>;
  settings: UserSettings;
  layout: LayoutNode;
}

export const MergedChat: React.FC<MergedChatProps> = ({ splits, settings, layout }) => {
  const [messages, setMessages] = useState<MergedMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxMessages = settings.maxMessages * 2; // more room in merged view

  // Global seen IDs to ensure absolute deduplication across re-renders & double mounts
  const globalSeenIdsRef = useRef<Set<string>>(new Set());

  // 1. Get split IDs actually present in the layout tree
  const activeSplitIds = useMemo(() => getActiveSplitIds(layout), [layout]);

  // 2. Map to splits, filter to active custom chats, and deduplicate by platform + channel name
  const activeSplits = useMemo(() => {
    const collected: Split[] = [];
    const seen = new Set<string>();

    activeSplitIds.forEach(id => {
      const split = splits[id];
      if (split && split.channel) {
        const normChannel = split.channel.trim().toLowerCase();
        const key = `${split.type}-${normChannel}`;
        if ((split.type === 'twitch-custom' || split.type === 'youtube-custom') && !seen.has(key)) {
          seen.add(key);
          collected.push(split);
        }
      }
    });

    return collected;
  }, [activeSplitIds, splits]);

  // Helper to add messages with duplicate checks and size capping
  const addMessageRef = useRef<(msg: MergedMessage) => void>(() => {});
  addMessageRef.current = (msg: MergedMessage) => {
    if (globalSeenIdsRef.current.has(msg.id)) {
      return; // Deduplicate
    }
    globalSeenIdsRef.current.add(msg.id);

    // Keep seen set under a reasonable size limit
    if (globalSeenIdsRef.current.size > 2000) {
      const arr = Array.from(globalSeenIdsRef.current);
      globalSeenIdsRef.current = new Set(arr.slice(arr.length - 1000));
    }

    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > maxMessages ? next.slice(next.length - maxMessages) : next;
    });
  };

  // Auto-scroll to bottom directly
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Window focus listener to snap to bottom on return
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    const handleFocus = () => {
      container.scrollTop = container.scrollHeight;
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Subscribe to Twitch channels
  useEffect(() => {
    const twitchSplits = activeSplits.filter(s => s.type === 'twitch-custom');
    if (twitchSplits.length === 0) return;

    const handlers: Array<{ channel: string; handler: (msg: any) => void }> = [];

    twitchSplits.forEach((split) => {
      const channel = split.channel.toLowerCase().trim();
      loadChannelEmotes(channel);

      const handler = (msg: any) => {
        const parts = parseMessage(msg.message, channel, msg.emotesTag, settings);
        const merged: MergedMessage = {
          id: msg.id + '-twitch-' + channel,
          source: 'twitch',
          channel,
          displayName: msg.displayName,
          userColor: msg.color || '#a1a1aa',
          parts,
          timestamp: msg.timestamp,
          badges: msg.badges || [],
        };
        addMessageRef.current(merged);
      };

      twitchIrc.subscribe(channel, handler);
      handlers.push({ channel, handler });
    });

    return () => {
      handlers.forEach(({ channel, handler }) => twitchIrc.unsubscribe(channel, handler));
    };
  }, [activeSplits, settings]);

  // Subscribe to YouTube channels
  useEffect(() => {
    const ytSplits = activeSplits.filter(s => s.type === 'youtube-custom');
    if (ytSplits.length === 0) return;

    const cleanups: Array<() => void> = [];

    ytSplits.forEach((split) => {
      const channel = split.channel.trim();
      let active = true;
      let pollTimeout: any = null;
      const seenIds = new Set<string>();
      // Drip queue
      const dripQueue: YoutubeChatMessage[] = [];
      let dripActive = false;
      let dripTimeout: any = null;

      const processDrip = () => {
        if (!active) return;
        if (dripQueue.length === 0) { dripActive = false; return; }
        dripActive = true;
        const msg = dripQueue.shift()!;
        const merged: MergedMessage = {
          id: msg.id + '-yt-' + channel,
          source: 'youtube',
          channel,
          displayName: msg.displayName,
          userColor: msg.color || '#ff4444',
          parts: msg.parts as unknown as MessagePart[],
          timestamp: msg.timestamp,
          badges: (msg.badges || []) as unknown as ChatBadge[],
          avatarUrl: msg.avatarUrl,
        };
        addMessageRef.current(merged);
        const delay = 50 + Math.random() * 300;
        dripTimeout = window.setTimeout(processDrip, delay);
      };

      const startPolling = async () => {
        try {
          let videoId = channel;
          const isHandle = channel.startsWith('@') ||
            (channel.length !== 11 && !channel.includes('youtube.com') && !channel.includes('youtu.be'));
          if (isHandle) videoId = await resolveYoutubeChannelToVideoId(channel);
          else {
            const m = channel.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
            videoId = (m && m[2].length === 11) ? m[2] : channel;
          }
          if (!active) return;

          const { apiKey, initialContinuation, visitorData } = await resolveInitialChatData(videoId);
          if (!active) return;

          let continuation = initialContinuation;
          const poll = async () => {
            if (!active) return;
            try {
              const data = await pollYoutubeChat(apiKey, continuation, visitorData);
              if (!active) return;
              const { messages: newMsgs, nextContinuation, timeoutMs } = parseYoutubeActions(data);
              const filtered = newMsgs.filter(m => !seenIds.has(m.id));
              for (const m of filtered) { seenIds.add(m.id); dripQueue.push(m); }
              if (!dripActive && filtered.length > 0) processDrip();
              if (nextContinuation) continuation = nextContinuation;
              pollTimeout = setTimeout(poll, timeoutMs ?? 1000);
            } catch { /* silent */ }
          };
          poll();
        } catch { /* silent */ }
      };

      startPolling();

      cleanups.push(() => {
        active = false;
        clearTimeout(pollTimeout);
        clearTimeout(dripTimeout);
      });
    });

    return () => cleanups.forEach(fn => fn());
  }, [activeSplits]);

  // Build a color map for channels based on deduplicated active splits
  const channelColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeSplits.forEach((s, i) => {
      map[s.channel.toLowerCase().trim()] = getChannelAccent(i);
    });
    return map;
  }, [activeSplits]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#000000' }}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-thin px-3 py-2 space-y-1.5"
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full" style={{ color: '#52525b' }}>
            <span className="text-sm">Waiting for messages…</span>
          </div>
        )}
        {messages.map(msg => {
          const accentColor = channelColorMap[msg.channel] ?? (msg.source === 'twitch' ? '#818cf8' : '#f87171');
          return (
            <div
              key={msg.id}
              className="py-0.5 px-1.5 rounded hover:bg-zinc-900/30 transition-colors"
              style={{ borderLeft: `2px solid ${accentColor}44` }}
            >
              {/* Timestamp */}
              {settings.showTimestamps && (
                <span className="text-[10px] font-mono mr-2.5 select-none align-middle" style={{ color: '#52525b' }}>
                  {msg.timestamp}
                </span>
              )}

              {/* Platform Logo */}
              {msg.source === 'twitch' ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{
                    width: '1.1em',
                    height: '1.1em',
                    color: '#a970ff',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                  className="select-none align-middle"
                >
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{
                    width: '1.1em',
                    height: '1.1em',
                    color: '#ff0000',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    marginRight: '0.5rem',
                    flexShrink: 0
                  }}
                  className="select-none align-middle"
                >
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.107c1.863.511 9.388.511 9.388.511s7.524 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107c.502-1.866.502-5.837.502-5.837s0-3.971-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              )}

              {/* Avatar (YouTube) */}
              {msg.avatarUrl && (
                <img
                  src={msg.avatarUrl}
                  alt=""
                  className="rounded-full inline-block align-middle mr-2 select-none"
                  style={{ width: '1.1em', height: '1.1em' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              )}

              {/* Badges */}
              {settings.showBadges && msg.badges.length > 0 && (
                <span className="inline-flex gap-1 mr-2 align-middle select-none">
                  {msg.badges.map((b, i) => {
                    const badgeUrl = (b as any).url || getFallbackBadgeUrl((b as any).name);
                    if (!badgeUrl) return null;
                    return (
                      <img
                        key={i}
                        src={badgeUrl}
                        alt={(b as any).name || ''}
                        title={(b as any).name || ''}
                        style={{
                          width: '1.1em',
                          height: '1.1em',
                          borderRadius: '2px',
                          objectFit: 'contain',
                          display: 'inline-block',
                          verticalAlign: 'middle'
                        }}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    );
                  })}
                </span>
              )}

              {/* Username */}
              <span
                className="font-semibold mr-2 align-middle"
                style={{ color: msg.userColor }}
              >
                {msg.displayName}:
              </span>

              {/* Message parts */}
              <span className="align-middle leading-snug break-all" style={{ color: '#e4e4e7' }}>
                {msg.parts.map((part, i) => {
                  if (part.type === 'emote') {
                    return (
                      <img
                        key={i}
                        src={(part as any).url || (part as any).emote?.url}
                        alt={(part as any).content || (part as any).emote?.name}
                        style={{ height: '1.6em', display: 'inline-block', verticalAlign: 'middle', margin: '0 0.1em' }}
                        onError={e => { (e.currentTarget as any).replaceWith((part as any).content || ''); }}
                      />
                    );
                  }
                  return <span key={i}>{(part as any).content}</span>;
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
