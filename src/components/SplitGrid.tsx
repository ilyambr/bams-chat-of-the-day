import React, { useState } from 'react';
import { Columns, Rows, Trash2, Check, RefreshCw } from 'lucide-react';
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

  if (!split) return null;

  const handleChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeChannel(splitId, channelInput.trim());
    setIsEditingChannel(false);
  };

  const handleSplitTypeChange = (type: SplitType) => {
    onChangeSplitType(splitId, type);
    // Auto-focus channel input for embeds/custom chats if type changes
    setIsEditingChannel(true);
  };

  return (
    <div className="flex flex-col w-full h-full rounded-sm overflow-hidden select-none" style={{ backgroundColor: '#000000', border: '1px solid #1a1a1a' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ backgroundColor: '#111111', borderColor: '#1a1a1a' }}>
        {/* Split Type Selector */}
        <div className="flex items-center gap-2">
          <select
            value={split.type}
            onChange={(e) => handleSplitTypeChange(e.target.value as SplitType)}
            className="bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 rounded px-2 py-1 outline-none cursor-pointer hover:border-slate-700 transition-colors"
          >
            <option value="twitch-custom">Twitch Chat (Custom)</option>
            <option value="twitch-embed">Twitch Chat (Embed)</option>
            <option value="youtube-embed">YouTube Chat (Embed)</option>
            <option value="youtube-custom">YouTube Chat (Custom)</option>
          </select>
          
          {/* Channel Info / Editing Input */}
          {isEditingChannel ? (
            <form onSubmit={handleChannelSubmit} className="flex items-center gap-1.5 animate-fade-in">
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
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
