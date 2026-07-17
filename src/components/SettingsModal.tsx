import React, { useState } from 'react';
import { X, Settings, Sliders, MessageSquare, ShieldCheck, Heart } from 'lucide-react';
import type { UserSettings } from '../types/chat';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'emotes' | 'highlights'>('general');
  const [localSettings, setLocalSettings] = useState<UserSettings>({ ...settings });
  const [highlightInput, setHighlightInput] = useState(settings.highlightWords.join(', '));

  if (!isOpen) return null;

  const handleCheckboxChange = (key: keyof UserSettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleValueChange = (key: keyof UserSettings, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    const highlights = highlightInput
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0);
    
    const finalSettings = {
      ...localSettings,
      highlightWords: highlights,
    };
    
    onSave(finalSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-lg">
            <Settings className="w-5 h-5 animate-spin-slow" />
            <span>settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-slate-800 bg-slate-950/20 p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-4 h-4" />
              General
            </button>
            <button
              onClick={() => setActiveTab('emotes')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'emotes'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Heart className="w-4 h-4" />
              Emotes
            </button>
            <button
              onClick={() => setActiveTab('highlights')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'highlights'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Highlights
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-900/50">
            {activeTab === 'general' && (
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Theme
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleValueChange('theme', 'dark')}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                        localSettings.theme === 'dark'
                          ? 'bg-slate-800 border-indigo-500 text-white shadow-sm'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      Slate Dark
                    </button>
                    <button
                      onClick={() => handleValueChange('theme', 'black')}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                        localSettings.theme === 'black'
                          ? 'bg-slate-950 border-indigo-500 text-white shadow-sm'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      OLED Black
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Font Size ({localSettings.fontSize}px)
                    </label>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={localSettings.fontSize}
                    onChange={(e) => handleValueChange('fontSize', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Emote Render Size
                  </label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => handleValueChange('emoteSize', size)}
                        className={`flex-1 py-1.5 rounded-lg border capitalize text-xs font-medium transition-all ${
                          localSettings.emoteSize === size
                            ? 'bg-slate-800 border-indigo-500 text-white shadow-sm'
                            : 'border-slate-800 text-slate-400 hover:bg-slate-800/30'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={localSettings.showTimestamps}
                      onChange={() => handleCheckboxChange('showTimestamps')}
                      className="w-4.5 h-4.5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      Show Chat Timestamps
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={localSettings.showBadges}
                      onChange={() => handleCheckboxChange('showBadges')}
                      className="w-4.5 h-4.5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      Show User Badges (Mod, Sub, etc.)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={localSettings.startMerged}
                      onChange={() => handleCheckboxChange('startMerged')}
                      className="w-4.5 h-4.5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      Start in Merged View
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Scroll Buffer Limits (Max Messages: {localSettings.maxMessages})
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={localSettings.maxMessages}
                    onChange={(e) => handleValueChange('maxMessages', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Capping messages prevents memory leaks and browser slowdowns during fast chats.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'emotes' && (
              <div className="flex flex-col gap-6">
                <div className="border border-slate-800/80 bg-slate-950/20 rounded-lg p-4 mb-2 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-400 leading-relaxed">
                    Toggle which emote providers are injected into the custom Twitch chat. Global and channel specific emotes will be fetched dynamically.
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 border border-slate-800 bg-slate-950/40 rounded-xl hover:border-slate-700 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-white">7TV Emotes</span>
                      <span className="text-xs text-slate-500 mt-0.5">Loads 7TV animated and static emotes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enable7tv}
                      onChange={() => handleCheckboxChange('enable7tv')}
                      className="w-5 h-5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-800 bg-slate-950/40 rounded-xl hover:border-slate-700 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-white">BetterTTV (BTTV) Emotes</span>
                      <span className="text-xs text-slate-500 mt-0.5">Loads BetterTTV shared and channel emotes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enableBttv}
                      onChange={() => handleCheckboxChange('enableBttv')}
                      className="w-5 h-5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-800 bg-slate-950/40 rounded-xl hover:border-slate-700 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-white">FrankerFaceZ (FFZ) Emotes</span>
                      <span className="text-xs text-slate-500 mt-0.5">Loads FrankerFaceZ public and channel emotes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.enableFfz}
                      onChange={() => handleCheckboxChange('enableFfz')}
                      className="w-5 h-5 bg-slate-800 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'highlights' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Highlight Words
                  </label>
                  <textarea
                    rows={4}
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    placeholder="e.g. myusername, hype, giveaway, mods"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Separate keywords with commas. If these words appear in a chat message, the message background will glow to grab your attention.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md hover:shadow-indigo-500/20 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
