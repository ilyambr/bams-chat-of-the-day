import { useState, useEffect } from 'react';
import { Settings, RefreshCw, Layers } from 'lucide-react';
import type { LayoutNode, Split, SplitType, UserSettings } from './types/chat';
import { SplitGrid } from './components/SplitGrid';
import { SettingsModal } from './components/SettingsModal';
import { MergedChat } from './components/MergedChat';
import { loadGlobalEmotes } from './services/emotes';


// Default initial state
const DEFAULT_SETTINGS: UserSettings = {
  theme: 'black',
  fontSize: 13,
  emoteSize: 'medium',
  showTimestamps: true,
  showBadges: true,
  highlightWords: [],
  enable7tv: true,
  enableBttv: true,
  enableFfz: true,
  maxMessages: 150,
  startMerged: false
};

const DEFAULT_SPLITS: Record<string, Split> = {
  'split-1': { id: 'split-1', type: 'twitch-custom', channel: 'shroud' },
  'split-2': { id: 'split-2', type: 'youtube-embed', channel: '' }
};

const DEFAULT_LAYOUT: LayoutNode = {
  id: 'root',
  type: 'container',
  direction: 'horizontal',
  children: [
    { id: 'node-1', type: 'split', splitId: 'split-1' },
    { id: 'node-2', type: 'split', splitId: 'split-2' }
  ]
};

// Tree helper: count leaf splits
function countSplits(root: LayoutNode): number {
  if (root.type === 'split') return 1;
  if (root.type === 'container' && root.children) {
    return root.children.reduce((sum, child) => sum + countSplits(child), 0);
  }
  return 0;
}

// Tree helper: split a specific leaf node
function splitNodeInTree(
  root: LayoutNode,
  targetId: string,
  direction: 'horizontal' | 'vertical',
  newSplitId: string
): LayoutNode {
  if (root.id === targetId) {
    const originalSplitId = root.splitId!;
    return {
      id: root.id,
      type: 'container',
      direction,
      children: [
        { id: `${root.id}-c1`, type: 'split', splitId: originalSplitId },
        { id: `${root.id}-c2`, type: 'split', splitId: newSplitId }
      ]
    };
  }

  if (root.type === 'container' && root.children) {
    return {
      ...root,
      children: root.children.map(child => 
        splitNodeInTree(child, targetId, direction, newSplitId)
      )
    };
  }

  return root;
}

// Tree helper: delete a split node and flatten single-child containers
function removeNodeFromTree(root: LayoutNode, targetId: string): LayoutNode | null {
  if (root.id === targetId) {
    return null; // Mark for deletion
  }

  if (root.type === 'container' && root.children) {
    const updatedChildren = root.children
      .map(child => removeNodeFromTree(child, targetId))
      .filter((child): child is LayoutNode => child !== null);

    if (updatedChildren.length === 0) {
      return null;
    }

    if (updatedChildren.length === 1) {
      // Flatten: if only one child remains, elevate it to replace the container
      return updatedChildren[0];
    }

    return {
      ...root,
      children: updatedChildren
    };
  }

  return root;
}

function App() {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('sidekick_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [splits, setSplits] = useState<Record<string, Split>>(() => {
    const saved = localStorage.getItem('sidekick_splits');
    return saved ? JSON.parse(saved) : DEFAULT_SPLITS;
  });

  const [layout, setLayout] = useState<LayoutNode>(() => {
    const saved = localStorage.getItem('sidekick_layout');
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMerged, setIsMerged] = useState(() => {
    const saved = localStorage.getItem('sidekick_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return !!parsed.startMerged;
      } catch (e) {}
    }
    return false;
  });

  // Load global 7TV/BTTV/FFZ emotes on startup
  useEffect(() => {
    loadGlobalEmotes();
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('sidekick_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('sidekick_splits', JSON.stringify(splits));
  }, [splits]);

  useEffect(() => {
    localStorage.setItem('sidekick_layout', JSON.stringify(layout));
  }, [layout]);

  // Apply theme class to document body
  useEffect(() => {
    const body = document.body;
    body.className = settings.theme === 'black' ? 'theme-black' : 'theme-dark';
  }, [settings.theme]);

  // Action: Split a pane
  const handleSplit = (nodeId: string, direction: 'horizontal' | 'vertical') => {
    const newSplitId = `split-${Date.now()}`;
    const newSplit: Split = {
      id: newSplitId,
      type: 'twitch-custom',
      channel: ''
    };

    setSplits(prev => ({ ...prev, [newSplitId]: newSplit }));
    setLayout(prev => splitNodeInTree(prev, nodeId, direction, newSplitId));
  };

  // Action: Close a split pane
  const handleCloseSplit = (nodeId: string) => {
    const splitCount = countSplits(layout);
    if (splitCount <= 1) return; // Prevent deleting the last split

    setLayout(prev => {
      const updated = removeNodeFromTree(prev, nodeId);
      return updated || prev;
    });
  };

  // Action: Change Type of Split (e.g. custom -> embed)
  const handleChangeSplitType = (splitId: string, type: SplitType) => {
    setSplits(prev => {
      const current = prev[splitId];
      if (!current) return prev;
      return {
        ...prev,
        [splitId]: {
          ...current,
          type,
          // Reset channel input if swapping between Twitch and YouTube to avoid loading wrong site
          channel: (current.type.startsWith('youtube') && !type.startsWith('youtube')) ||
                   (!current.type.startsWith('youtube') && type.startsWith('youtube'))
                    ? '' 
                    : current.channel
        }
      };
    });
  };

  // Action: Change Channel or Video Target
  const handleChangeChannel = (splitId: string, channel: string) => {
    setSplits(prev => {
      const current = prev[splitId];
      if (!current) return prev;
      return {
        ...prev,
        [splitId]: {
          ...current,
          channel
        }
      };
    });
  };

  const handleResetLayout = () => {
    if (window.confirm('Reset workspace layout to Twitch & YouTube side-by-side defaults?')) {
      setSplits(DEFAULT_SPLITS);
      setLayout(DEFAULT_LAYOUT);
    }
  };

  const isOnlySplit = countSplits(layout) <= 1;

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans select-none bg-slate-950 text-slate-100">
      {/* Main Workspace Layout Area */}
      <main className="flex-1 min-h-0 relative bg-slate-950">
        {isMerged ? (
          <MergedChat splits={splits} settings={settings} layout={layout} />
        ) : (
          <SplitGrid
            node={layout}
            splits={splits}
            settings={settings}
            onSplit={handleSplit}
            onCloseSplit={handleCloseSplit}
            onChangeSplitType={handleChangeSplitType}
            onChangeChannel={handleChangeChannel}
            isOnlySplit={isOnlySplit}
          />
        )}
      </main>

      {/* Bottom Status / Configuration Bar */}
      <footer className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-400 select-none shrink-0" style={{ backgroundColor: '#111111', borderTop: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-2">
          <img
            src="https://ilyambr.com/bams/clips/assets/ilyambr.png"
            alt="ilyambr"
            style={{ height: '32px', width: 'auto', objectFit: 'contain', opacity: 0.45 }}
          />
        </div>
        
        <div className="flex items-center gap-2.5">

          <button
            onClick={() => setIsMerged(v => !v)}
            className="p-1 rounded transition-colors"
            style={{ color: isMerged ? '#818cf8' : '#a1a1aa', background: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = isMerged ? '#818cf8' : '#ffffff')}
            onMouseLeave={e => (e.currentTarget.style.color = isMerged ? '#818cf8' : '#a1a1aa')}
            title={isMerged ? 'Back to split view' : 'Merge all chats into one feed'}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleResetLayout}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset Layout to default side-by-side splits"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Configure settings & emotes"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
}

export default App;
