import React, { useState, useEffect, useRef } from 'react';
import { Columns, Rows, Trash2, Check, RefreshCw, ChevronDown } from 'lucide-react';
import type { LayoutNode, Split, SplitType, UserSettings } from '../types/chat';
import { TwitchCustomChat } from './TwitchCustomChat';
import { YoutubeCustomChat } from './YoutubeCustomChat';
import { ChatEmbed } from './ChatEmbed';

interface SplitGridProps {
  node: LayoutNode;
  splits: Record<string, Split>;
  settings: UserSettings;
  onSplit: (nodeId: string, direction: 'horizontal' | 'vertical') => void;
  onCloseSplit: (nodeId: string) => void;
  onChangeSplitType: (splitId: string, type: SplitType) => void;
  onChangeChannel: (splitId: string, channel: string) => void;
  isOnlySplit: boolean;
}

export const SplitGrid: React.FC<SplitGridProps> = ({
  node,
  splits,
  settings,
  onSplit,
  onCloseSplit,
  onChangeSplitType,
  onChangeChannel,
  isOnlySplit,
}) => {
  // If it's a container, recursively render its children
  if (node.type === 'container' && node.children && node.children.length > 0) {
    const isHorizontal = node.direction === 'horizontal';
    
    return (
      <div 
        className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full divide-slate-800`}
        style={{
          gap: '2px', // Thin border between splits
          backgroundColor: '#000000', // Black gap between splits
        }}
      >
        {node.children.map((child) => (
          <div 
            key={child.id} 
            className="flex-1 min-w-0 min-h-0 relative"
          >
            <SplitGrid
              node={child}
              splits={splits}
              settings={settings}
              onSplit={onSplit}
              onCloseSplit={onCloseSplit}
              onChangeSplitType={onChangeSplitType}
              onChangeChannel={onChangeChannel}
              isOnlySplit={isOnlySplit}
            />
          </div>
        ))}
      </div>
    );
  }

  // Leaf Node - Render the split frame
  const splitId = node.splitId || '';
  const split = splits[splitId];
  
  return (
    <SplitFrame
      nodeId={node.id}
      splitId={splitId}
      split={split}
      settings={settings}
      onSplit={onSplit}
      onCloseSplit={onCloseSplit}
      onChangeSplitType={onChangeSplitType}
      onChangeChannel={onChangeChannel}
      isOnlySplit={isOnlySplit}
    />
  );
};

// Component for a single split pane (header + content)
interface SplitFrameProps {
  nodeId: string;
  splitId: string;
  split?: Split;
  settings: UserSettings;
  onSplit: (nodeId: string, direction: 'horizontal' | 'vertical') => void;
  onCloseSplit: (nodeId: string) => void;
  onChangeSplitType: (splitId: string, type: SplitType) => void;
  onChangeChannel: (splitId: string, channel: string) => void;
  isOnlySplit: boolean;
}

const TwitchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
  </svg>
);

const YoutubeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.51a3.002 3.002 0 0 0-2.11 2.108C0 8.029 0 12 0 12s0 3.971.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.863.51 9.388.51 9.388.51s7.524 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.971 24 12 24 12s0-3.971-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface ServiceDropdownProps {
  value: SplitType;
  onChange: (type: SplitType) => void;
}

const ServiceDropdown: React.FC<ServiceDropdownProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isTwitch = value.startsWith('twitch');
  const isYoutube = value.startsWith('youtube');
  const isCustom = value.endsWith('custom');
  const isEmbed = value.endsWith('embed');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectService = (service: 'twitch' | 'youtube') => {
    const mode = isCustom ? 'custom' : 'embed';
    onChange(`${service}-${mode}` as SplitType);
  };

  const handleSelectMode = (mode: 'custom' | 'embed') => {
    const service = isTwitch ? 'twitch' : 'youtube';
    onChange(`${service}-${mode}` as SplitType);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-[11px] rounded px-2.5 py-1 transition-all outline-none"
      >
        <span>Service:</span>
        <span className="flex items-center gap-1 font-bold text-slate-100">
          {isTwitch ? (
            <>
              <TwitchIcon className="w-3.5 h-3.5 text-[#9146FF]" />
              <span>Twitch</span>
            </>
          ) : (
            <>
              <YoutubeIcon className="w-3.5 h-3.5 text-[#FF0000]" />
              <span>YouTube</span>
            </>
          )}
        </span>
        <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded leading-none">
          {isCustom ? 'Custom' : 'Embed'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 p-2.5 flex flex-col gap-2.5 animate-fade-in">
          {/* Service Section */}
          <div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Service
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSelectService('twitch');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all border ${
                  isTwitch
                    ? 'bg-[#9146FF]/10 border-[#9146FF] text-white shadow-lg shadow-[#9146FF]/10'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <TwitchIcon className={`w-3.5 h-3.5 ${isTwitch ? 'text-[#9146FF]' : 'text-slate-400'}`} />
                <span>Twitch</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectService('youtube');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold transition-all border ${
                  isYoutube
                    ? 'bg-[#FF0000]/10 border-[#FF0000] text-white shadow-lg shadow-[#FF0000]/10'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <YoutubeIcon className={`w-3.5 h-3.5 ${isYoutube ? 'text-[#FF0000]' : 'text-slate-400'}`} />
                <span>YouTube</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-900"></div>

          {/* Mode Section */}
          <div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Type / Mode
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handleSelectMode('custom');
                }}
                className={`flex items-center justify-between py-1.5 px-2.5 rounded text-left text-xs font-medium transition-all border ${
                  isCustom
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200 font-bold'
                    : 'bg-slate-900/20 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <span>Custom Chat</span>
                {isCustom && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectMode('embed');
                }}
                className={`flex items-center justify-between py-1.5 px-2.5 rounded text-left text-xs font-medium transition-all border ${
                  isEmbed
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-200 font-bold'
                    : 'bg-slate-900/20 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <span>Embedded Chat</span>
                {isEmbed && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SplitFrame: React.FC<SplitFrameProps> = ({
  nodeId,
  splitId,
  split,
  settings,
  onSplit,
  onCloseSplit,
  onChangeSplitType,
  onChangeChannel,
  isOnlySplit,
}) => {
  const [channelInput, setChannelInput] = useState(split?.channel || '');
  const [isEditingChannel, setIsEditingChannel] = useState(!split?.channel);

  useEffect(() => {
    setChannelInput(split?.channel || '');
    setIsEditingChannel(!split?.channel);
  }, [split?.channel]);

  if (!split) return null;

  const handleChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeChannel(splitId, channelInput.trim());
    setIsEditingChannel(false);
  };

  const handleBlur = () => {
    const trimmed = channelInput.trim();
    if (trimmed !== (split?.channel || '')) {
      onChangeChannel(splitId, trimmed);
    }
    if (trimmed) {
      setIsEditingChannel(false);
    }
  };

  const handleSplitTypeChange = (type: SplitType) => {
    onChangeSplitType(splitId, type);
    setIsEditingChannel(true);
  };

  return (
    <div className="flex flex-col w-full h-full rounded-sm overflow-hidden select-none" style={{ backgroundColor: '#000000', border: '1px solid #1a1a1a' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ backgroundColor: '#111111', borderColor: '#1a1a1a' }}>
        {/* Split Type Selector */}
        <div className="flex items-center gap-2">
          <ServiceDropdown
            value={split.type}
            onChange={handleSplitTypeChange}
          />
          
          {/* Channel Info / Editing Input */}
          {isEditingChannel ? (
            <form onSubmit={handleChannelSubmit} className="flex items-center gap-1.5 animate-fade-in">
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onBlur={handleBlur}
                placeholder={
                  split.type.startsWith('youtube') 
                    ? 'Video ID or URL...' 
                    : 'Twitch Channel...'
                }
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded px-2 py-0.5 max-w-[150px] outline-none focus:border-indigo-500"
                autoFocus
              />
              <button 
                type="submit" 
                className="p-1 hover:bg-slate-800 rounded text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Confirm Channel"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <span 
                className="text-xs font-bold text-indigo-400 cursor-pointer hover:underline"
                onClick={() => setIsEditingChannel(true)}
                title="Click to edit channel/video"
              >
                {split.channel || '(No channel)'}
              </span>
              <button
                onClick={() => setIsEditingChannel(true)}
                className="p-0.5 hover:bg-slate-800 rounded text-slate-100 hover:text-white transition-colors"
                title="Change Channel"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Split / Close Controls */}
        <div className="flex items-center gap-1" style={{ color: '#a1a1aa' }}>
          <button
            onClick={() => onSplit(nodeId, 'horizontal')}
            className="p-1 rounded transition-colors"
            style={{ color: 'inherit', background: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
            title="Split Vertically (columns)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSplit(nodeId, 'vertical')}
            className="p-1 rounded transition-colors"
            style={{ color: 'inherit', background: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
            title="Split Horizontally (rows)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
          
          {!isOnlySplit && (
            <button
              onClick={() => onCloseSplit(nodeId)}
              className="p-1 rounded transition-colors ml-1"
              style={{ color: 'inherit', background: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fb7185')}
              onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
              title="Close Split"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Frame content */}
      <div className="flex-1 min-h-0 min-w-0 bg-slate-950">
        {split.type === 'twitch-custom' ? (
          <TwitchCustomChat
            channel={split.channel}
            settings={settings}
          />
        ) : split.type === 'youtube-custom' ? (
          <YoutubeCustomChat
            channel={split.channel}
            settings={settings}
          />
        ) : (
          <ChatEmbed
            type={split.type}
            channel={split.channel}
          />
        )}
      </div>
    </div>
  );
};
