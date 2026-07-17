import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowDown, AlertCircle } from 'lucide-react';
import type { ChatMessage, UserSettings } from '../types/chat';
import { twitchIrc } from '../services/twitchIrc';
import { parseMessage, loadChannelEmotes } from '../services/emotes';

interface TwitchCustomChatProps {
  channel: string;
  settings: UserSettings;
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
      return 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1'; // Default star
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

export const TwitchCustomChat: React.FC<TwitchCustomChatProps> = ({ channel, settings }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [channelStatus, setChannelStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Clean channel name
  const cleanChannel = useMemo(() => channel.toLowerCase().trim(), [channel]);

  // Subscribe to Twitch IRC and monitor connection state
  useEffect(() => {
    if (!cleanChannel) return;

    setMessages([]);
    setChannelStatus(twitchIrc.isConnected() ? 'connected' : 'connecting');

    // Pre-load emotes for the channel (silently)
    loadChannelEmotes(cleanChannel);

    const handleMessage = (msg: ChatMessage) => {
      setChannelStatus('connected');
      
      // Parse message parts on the fly
      const parsedParts = parseMessage(msg.message, cleanChannel, msg.emotesTag, settings);
      
      // Check if message is highlighted
      const isHighlighted = settings.highlightWords.some(word => 
        msg.message.toLowerCase().includes(word.toLowerCase()) || 
        msg.displayName.toLowerCase().includes(word.toLowerCase())
      );

      const parsedMsg = {
        ...msg,
        parts: parsedParts,
        isHighlighted
      };

      setMessages(prev => {
        // Keep within limits
        const truncated = prev.length >= settings.maxMessages 
          ? prev.slice(prev.length - settings.maxMessages + 1) 
          : prev;
        return [...truncated, parsedMsg];
      });
    };

    twitchIrc.subscribe(cleanChannel, handleMessage);

    // Periodically sync connection state in the UI (handles online/offline state dynamically)
    const statusInterval = setInterval(() => {
      setChannelStatus(twitchIrc.isConnected() ? 'connected' : 'connecting');
    }, 1000);

    return () => {
      twitchIrc.unsubscribe(cleanChannel, handleMessage);
      clearInterval(statusInterval);
    };
  }, [cleanChannel, settings.maxMessages]);

  // Re-parse messages when emote/highlight settings change
  useEffect(() => {
    if (!cleanChannel) return;
    setMessages(prev => prev.map(msg => {
      if (msg.isSystem) return msg;
      
      const parsedParts = parseMessage(msg.message, cleanChannel, msg.emotesTag, settings);
      const isHighlighted = settings.highlightWords.some(word => 
        msg.message.toLowerCase().includes(word.toLowerCase()) || 
        msg.displayName.toLowerCase().includes(word.toLowerCase())
      );

      return {
        ...msg,
        parts: parsedParts,
        isHighlighted
      };
    }));
  }, [settings.enable7tv, settings.enableBttv, settings.enableFfz, settings.highlightWords]);

  // Sync isAtBottom ref immediately on change
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const lastProgrammaticScrollTimeRef = useRef(0);

  // Scroll to bottom on new messages directly (fires per-instance, per-split)
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const container = scrollRef.current;
    if (container) {
      lastProgrammaticScrollTimeRef.current = Date.now();
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // ResizeObserver for layout/split resizes, and window focus handler to snap to bottom when focus returns
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        lastProgrammaticScrollTimeRef.current = Date.now();
        container.scrollTop = container.scrollHeight;
      }
    });
    resizeObserver.observe(container);

    const handleFocus = () => {
      if (isAtBottomRef.current && container) {
        lastProgrammaticScrollTimeRef.current = Date.now();
        container.scrollTop = container.scrollHeight;
      }
    };

    window.addEventListener('focus', handleFocus);
    // Also snap on visibility state returns (e.g. after exiting a fullscreen app)
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    
    // Ignore scroll check if we recently programmatically scrolled (within 200ms)
    if (Date.now() - lastProgrammaticScrollTimeRef.current < 200) {
      return;
    }

    // Ignore scroll check if the window/document is out of focus (prevent false scroll-freeze states)
    if (document.hidden || !document.hasFocus()) {
      return;
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    setIsAtBottom(nearBottom);
  };

  const scrollToBottom = () => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      setIsAtBottom(true);
      isAtBottomRef.current = true;
    }
  };



  // Map emote size settings to inline styles in font-relative em units
  const emoteStyle = useMemo(() => {
    let height = '1.6em';
    let marginY = '-0.3em';
    if (settings.emoteSize === 'small') {
      height = '1.2em';
      marginY = '-0.15em';
    } else if (settings.emoteSize === 'large') {
      height = '2.2em';
      marginY = '-0.45em';
    }
    
    return {
      height,
      display: 'inline-block',
      verticalAlign: 'middle',
      marginTop: marginY,
      marginBottom: marginY,
      marginLeft: '0.1em',
      marginRight: '0.1em'
    };
  }, [settings.emoteSize]);

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-950/20 p-4">
        <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm">Please set a Twitch channel name in the split header.</p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden"
    >
      {/* Message Feed */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 select-text scrollbar-thin scrollbar-thumb-slate-800 hover:scrollbar-thumb-slate-700"
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`group py-0.5 px-1.5 rounded transition-colors ${
              msg.isHighlighted 
                ? 'bg-rose-950/25 border-l-2 border-rose-500 text-rose-100 pl-1' 
                : 'hover:bg-slate-900/30'
            }`}
          >
            {/* Timestamp */}
            {settings.showTimestamps && (
              <span className="text-slate-500 text-[10px] font-mono mr-2.5 select-none align-middle">
                {msg.timestamp}
              </span>
            )}

            {/* Badges */}
            {settings.showBadges && msg.badges.length > 0 && (
              <span className="inline-flex gap-1 mr-2 align-middle select-none">
                {msg.badges.map((badge, idx) => (
                  <img 
                    key={`${badge.name}-${idx}`} 
                    src={badge.url} 
                    alt={badge.name}
                    title={badge.name}
                    style={{
                      width: '1.1em',
                      height: '1.1em',
                      borderRadius: '2px',
                      objectFit: 'contain',
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }}
                    onError={(e) => {
                      const fallback = getFallbackBadgeUrl(badge.name);
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      } else {
                        e.currentTarget.style.display = 'none';
                      }
                    }}
                  />
                ))}
              </span>
            )}

            {/* Username */}
            <span 
              className="font-semibold mr-2 align-middle cursor-pointer hover:underline text-[1.05em]"
              style={{ color: msg.isSystem ? '#94a3b8' : msg.color }}
              title={`Click to copy username: ${msg.username}`}
              onClick={() => {
                navigator.clipboard.writeText(msg.username);
              }}
            >
              {msg.displayName || msg.username}
              {!msg.isSystem && ':'}
            </span>

            {/* Parsed Message Parts */}
            <span className={`align-middle leading-[1.4] break-all ${msg.isSystem ? 'text-slate-400 italic text-[0.95em]' : 'text-slate-100'}`}>
              {msg.parts.map((part, idx) => {
                if (part.type === 'emote') {
                  return (
                    <img 
                      key={idx} 
                      src={part.emote.url} 
                      alt={part.emote.name} 
                      title={`${part.emote.name} (${part.emote.provider.toUpperCase()})`}
                      style={emoteStyle}
                    />
                  );
                } else if (part.type === 'link') {
                  return (
                    <a 
                      key={idx} 
                      href={part.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-indigo-400 hover:text-indigo-300 underline break-all mx-0.5"
                    >
                      {part.url}
                    </a>
                  );
                } else {
                  return <span key={idx}>{part.content}</span>;
                }
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Floating Action Pill */}
      {!isAtBottom && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <button 
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-full shadow-lg transition-colors border border-indigo-400/20"
          >
            <ArrowDown className="w-3 h-3" />
            <span>More messages below</span>
          </button>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="flex items-center px-3 py-1 bg-slate-950/80 border-t border-slate-900 text-[10px] text-slate-500 select-none">
        <div 
          className={`w-2 h-2 rounded-full ${
            channelStatus === 'connected' ? 'bg-emerald-500' :
            channelStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
          }`} 
          title={`Connection status: ${channelStatus}`}
        />
      </div>
    </div>
  );
};
