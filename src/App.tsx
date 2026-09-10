import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Maximize,
  Minimize,
  Edit3,
  X,
  Eye,
  Tv,
  Smartphone,
  Layers,
  ChevronUp,
  History,
  Trash2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Film,
} from 'lucide-react';

const TARGET_DEFAULT_URL = 'https://movielover-tau.vercel.app/?view=tv';
const RECENT_STORAGE_KEY = 'fullscreen_iframe_recents';
const SETTINGS_STORAGE_KEY = 'fullscreen_iframe_settings';

const POPULAR_PRESETS = [
  { name: 'Movie Lover TV', url: 'https://movielover-tau.vercel.app/?view=tv' },
  { name: 'Wikipedia', url: 'https://en.m.wikipedia.org' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
  { name: 'Internet Archive', url: 'https://archive.org' },
];

function formatUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export default function App() {
  const [inputUrl, setInputUrl] = useState<string>(TARGET_DEFAULT_URL);
  const [activeUrl, setActiveUrl] = useState<string>(TARGET_DEFAULT_URL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(false); // Starts hidden for pristine edge-to-edge full screen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [editUrlInput, setEditUrlInput] = useState<string>('');
  const [recents, setRecents] = useState<string[]>([]);

  // Multi-layer and display settings
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [tvOverscanPadding, setTvOverscanPadding] = useState<number>(0);
  const [autoHideToolbar, setAutoHideToolbar] = useState<boolean>(true);

  const hideTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with HTML iframe element
  const getIframeElement = (): HTMLIFrameElement | null => {
    return document.getElementById('fullscreen-webview-iframe') as HTMLIFrameElement | null;
  };

  const getWrapperElement = (): HTMLElement | null => {
    return document.getElementById('iframe-wrapper');
  };

  // Load saved recents and settings
  useEffect(() => {
    try {
      const savedRecents = localStorage.getItem(RECENT_STORAGE_KEY);
      if (savedRecents) {
        setRecents(JSON.parse(savedRecents));
      } else {
        setRecents([TARGET_DEFAULT_URL]);
      }

      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (typeof parsed.zoomLevel === 'number') setZoomLevel(parsed.zoomLevel);
        if (typeof parsed.tvOverscanPadding === 'number') setTvOverscanPadding(parsed.tvOverscanPadding);
        if (typeof parsed.autoHideToolbar === 'boolean') setAutoHideToolbar(parsed.autoHideToolbar);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveSettings = (newSettings: {
    zoomLevel: number;
    tvOverscanPadding: number;
    autoHideToolbar: boolean;
  }) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // Ignore
    }
  };

  const saveToRecents = (url: string) => {
    try {
      const updated = [url, ...recents.filter((item) => item !== url)].slice(0, 8);
      setRecents(updated);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const clearRecents = () => {
    setRecents([]);
    try {
      localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Check URL query parameters or initialize
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('url');
    const hashUrl = window.location.hash ? window.location.hash.slice(1) : '';

    const target = queryUrl || hashUrl || TARGET_DEFAULT_URL;
    if (target) {
      const formatted = formatUrl(target);
      setActiveUrl(formatted);
      setInputUrl(formatted);
      saveToRecents(formatted);

      const frame = getIframeElement();
      if (frame && frame.src !== formatted) {
        frame.src = formatted;
      }
    }
  }, []);

  // Update HTML wrapper styling based on zoom and TV overscan settings
  useEffect(() => {
    const wrapper = getWrapperElement();
    const frame = getIframeElement();

    if (wrapper) {
      if (activeUrl) {
        wrapper.style.display = 'block';
        wrapper.style.padding = tvOverscanPadding > 0 ? `${tvOverscanPadding}vh ${tvOverscanPadding}vw` : '0px';
      } else {
        wrapper.style.display = 'none';
      }
    }

    if (frame) {
      frame.style.transform = zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none';
      frame.style.transformOrigin = 'center center';
    }
  }, [activeUrl, tvOverscanPadding, zoomLevel]);

  // Hook iframe onLoad event
  useEffect(() => {
    const frame = getIframeElement();
    if (!frame) return;

    const handleLoad = () => {
      setIsLoading(false);
    };

    frame.addEventListener('load', handleLoad);
    return () => {
      frame.removeEventListener('load', handleLoad);
    };
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide toolbar logic
  const revealControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    if (autoHideToolbar) {
      hideTimerRef.current = window.setTimeout(() => {
        setIsControlsVisible(false);
      }, 2500);
    }
  }, [autoHideToolbar]);

  // Smart TV Remote & Keyboard controller
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // TV Remote keys:
      // Tizen Back: 10009, webOS Back: 461, Android Back: 4, Escape: 27
      if (
        e.key === 'Escape' ||
        e.keyCode === 10009 ||
        e.keyCode === 461 ||
        e.keyCode === 4 ||
        e.key === 'GoBack'
      ) {
        if (showEditModal) {
          setShowEditModal(false);
          e.preventDefault();
        } else if (showSettingsModal) {
          setShowSettingsModal(false);
          e.preventDefault();
        } else if (activeUrl) {
          setIsControlsVisible((prev) => !prev);
          e.preventDefault();
        }
      }

      if (activeUrl && autoHideToolbar) {
        revealControlsTemporarily();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEditModal, showSettingsModal, activeUrl, autoHideToolbar, revealControlsTemporarily]);

  const handleLaunch = (targetUrl?: string) => {
    const toLaunch = targetUrl || inputUrl;
    const formatted = formatUrl(toLaunch);
    if (!formatted) return;

    setActiveUrl(formatted);
    setIsLoading(true);
    saveToRecents(formatted);

    const frame = getIframeElement();
    if (frame) {
      frame.src = formatted;
    }

    try {
      window.history.replaceState(null, '', `?url=${encodeURIComponent(formatted)}`);
    } catch {
      // Ignore
    }

    if (autoHideToolbar) {
      revealControlsTemporarily();
    }
  };

  const handleReset = () => {
    setActiveUrl('');
    setInputUrl('');
    setIsLoading(false);
    const wrapper = getWrapperElement();
    if (wrapper) {
      wrapper.style.display = 'none';
    }
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // Ignore
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    const frame = getIframeElement();
    if (frame) {
      const current = frame.src;
      frame.src = 'about:blank';
      setTimeout(() => {
        frame.src = current;
      }, 50);
    }
    if (autoHideToolbar) {
      revealControlsTemporarily();
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported
    }
  };

  const handleOpenExternal = () => {
    if (activeUrl) {
      window.open(activeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // If website is actively loaded, render HUD overlay controls
  if (activeUrl) {
    return (
      <div
        id="hud-overlay-container"
        onMouseMove={autoHideToolbar ? revealControlsTemporarily : undefined}
        onTouchStart={autoHideToolbar ? revealControlsTemporarily : undefined}
        className="fixed inset-0 w-screen h-screen pointer-events-none select-none z-30"
      >
        {/* Loading Indicator */}
        {isLoading && (
          <div
            id="iframe-loader"
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs z-30 pointer-events-none transition-opacity duration-300 text-zinc-100"
          >
            <div className="flex items-center space-x-3 px-5 py-3 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl">
              <RotateCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="text-sm font-medium tracking-wide">Loading Movie Lover TV...</span>
            </div>
          </div>
        )}

        {/* Floating Top Control Bar */}
        <header
          id="floating-control-bar"
          className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-in-out max-w-[96vw] pointer-events-auto ${
            isControlsVisible
              ? 'translate-y-0 opacity-100'
              : '-translate-y-16 opacity-0 !pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-950/95 border border-zinc-800/90 text-zinc-200 shadow-2xl backdrop-blur-md">
            {/* Active URL badge */}
            <div
              id="active-url-display"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 text-xs font-mono text-zinc-300 max-w-[140px] sm:max-w-xs md:max-w-md truncate border border-zinc-800"
              title={activeUrl}
            >
              <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{activeUrl}</span>
            </div>

            {/* Change URL */}
            <button
              id="btn-edit-url"
              type="button"
              onClick={() => {
                setEditUrlInput(activeUrl);
                setShowEditModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Change URL"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change</span>
            </button>

            {/* Reload button */}
            <button
              id="btn-reload-iframe"
              type="button"
              onClick={handleReload}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Reload Frame"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Open in new tab */}
            <button
              id="btn-open-external"
              type="button"
              onClick={handleOpenExternal}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Open in new window / external browser"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Settings */}
            <button
              id="btn-display-settings"
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Device, Zoom & TV Overscan Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen browser toggle */}
            <button
              id="btn-toggle-fullscreen"
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Reset / Blank page */}
            <button
              id="btn-close-iframe"
              type="button"
              onClick={handleReset}
              className="p-2 text-xs font-medium rounded-xl hover:bg-red-950 hover:text-red-300 text-zinc-400 transition-colors cursor-pointer focus-visible:ring-2"
              title="Exit to blank screen"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Collapse toolbar */}
            <button
              id="btn-collapse-bar"
              type="button"
              onClick={() => setIsControlsVisible(false)}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-400 focus-visible:ring-2"
              title="Hide toolbar completely"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Small restore icon at top right */}
        {!isControlsVisible && (
          <button
            id="btn-restore-bar"
            type="button"
            onClick={() => {
              setIsControlsVisible(true);
              if (autoHideToolbar) revealControlsTemporarily();
            }}
            className="fixed top-2 right-3 z-40 p-2 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 shadow-xl backdrop-blur-md opacity-30 hover:opacity-100 transition-all cursor-pointer pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2"
            title="Show Controls (or press Remote Back/Escape)"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Change URL Modal */}
        {showEditModal && (
          <div
            id="modal-change-url"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs pointer-events-auto"
          >
            <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-semibold">Change Website URL</h2>
                </div>
                <button
                  id="btn-close-edit-modal"
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:ring-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                id="form-change-url"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editUrlInput.trim()) {
                    handleLaunch(editUrlInput);
                    setShowEditModal(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <input
                    id="input-change-url"
                    type="text"
                    value={editUrlInput}
                    onChange={(e) => setEditUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    id="btn-cancel-modal"
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 text-sm rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:ring-2"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-modal"
                    type="submit"
                    className="px-5 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors cursor-pointer focus-visible:ring-2"
                  >
                    Load URL
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Display & Settings Modal */}
        {showSettingsModal && (
          <div
            id="modal-settings"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pointer-events-auto"
          >
            <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-semibold">Device & Display Controls</h2>
                </div>
                <button
                  id="btn-close-settings-modal"
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:ring-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 text-sm">
                {/* TV Overscan Compensation */}
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-cyan-400" />
                      <span className="font-medium text-zinc-200">Smart TV Overscan Fit</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{tvOverscanPadding}% Safe Area</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                    If your TV screen cuts off edges or headers, add safe-area overscan padding.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 2, 4, 6].map((pad) => (
                      <button
                        key={pad}
                        type="button"
                        onClick={() => {
                          setTvOverscanPadding(pad);
                          saveSettings({ zoomLevel, tvOverscanPadding: pad, autoHideToolbar });
                        }}
                        className={`py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                          tvOverscanPadding === pad
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {pad === 0 ? '0% (Exact)' : `${pad}% Safe`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scale / Zoom */}
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ZoomIn className="w-4 h-4 text-amber-400" />
                      <span className="font-medium text-zinc-200">Scale / Zoom</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">{zoomLevel}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newZ = Math.max(50, zoomLevel - 10);
                        setZoomLevel(newZ);
                        saveSettings({ zoomLevel: newZ, tvOverscanPadding, autoHideToolbar });
                      }}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={zoomLevel}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setZoomLevel(val);
                        saveSettings({ zoomLevel: val, tvOverscanPadding, autoHideToolbar });
                      }}
                      className="flex-1 accent-indigo-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newZ = Math.min(150, zoomLevel + 10);
                        setZoomLevel(newZ);
                        saveSettings({ zoomLevel: newZ, tvOverscanPadding, autoHideToolbar });
                      }}
                      className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(100);
                        saveSettings({ zoomLevel: 100, tvOverscanPadding, autoHideToolbar });
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      100%
                    </button>
                  </div>
                </div>

                {/* Auto-hide toolbar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div>
                    <span className="font-medium text-zinc-200 block">Auto-Hide Floating Toolbar</span>
                    <span className="text-xs text-zinc-500">Hides controls so web page layers stay unobstructed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !autoHideToolbar;
                      setAutoHideToolbar(nextVal);
                      saveSettings({ zoomLevel, tvOverscanPadding, autoHideToolbar: nextVal });
                      if (!nextVal) setIsControlsVisible(true);
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      autoHideToolbar ? 'bg-indigo-600' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        autoHideToolbar ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer focus-visible:ring-2"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Blank landing view (if user explicitly closed or reset URL)
  return (
    <main
      id="blank-fullscreen-view"
      className="fixed inset-0 w-screen h-screen h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-zinc-950 text-zinc-100 overflow-y-auto z-30 pointer-events-auto"
    >
      <div className="w-full max-w-xl flex flex-col items-center text-center my-auto">
        <div id="device-support-badge" className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
            <Film className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
            <Tv className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
            <Smartphone className="w-5 h-5 text-purple-400" />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <h1 id="main-heading" className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2">
          Movie Lover TV Web Viewer
        </h1>
        <p id="main-subtext" className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          Smart TV, Mobile, Emulator এবং যেকোনো ডিভাইসের জন্য মাল্টি-লেয়ার ফুল স্ক্রিন ওয়েব ভিউ।
        </p>

        {/* 1-Click Launch Button for Movie Lover TV */}
        <button
          id="btn-launch-movielover-direct"
          type="button"
          onClick={() => handleLaunch(TARGET_DEFAULT_URL)}
          className="w-full mb-6 py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-indigo-600/20 transition-all cursor-pointer focus-visible:ring-2"
        >
          <Film className="w-5 h-5" />
          <span>Launch Movie Lover TV in Full Screen</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Input Card Form */}
        <form
          id="form-url-launcher"
          onSubmit={(e) => {
            e.preventDefault();
            handleLaunch();
          }}
          className="w-full relative"
        >
          <div className="flex items-center w-full rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all shadow-2xl p-1.5">
            <div className="pl-3.5 pr-2 text-zinc-500">
              <Globe className="w-5 h-5" />
            </div>
            <input
              id="input-website-url"
              ref={inputRef}
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              className="flex-1 bg-transparent py-3 px-2 text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
            />
            <button
              id="btn-launch-webview"
              type="submit"
              disabled={!inputUrl.trim()}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium shadow-md transition-all cursor-pointer shrink-0 focus-visible:ring-2"
            >
              <span>Load URL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Presets */}
        <div id="quick-presets" className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Presets:
          </span>
          {POPULAR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              id={`preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              onClick={() => {
                setInputUrl(preset.url);
                handleLaunch(preset.url);
              }}
              className="px-3 py-1 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-300 hover:text-white transition-colors cursor-pointer focus-visible:ring-2"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Recents */}
        {recents.length > 0 && (
          <div id="recent-urls-panel" className="mt-6 w-full text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Quick Access Websites
              </span>
              <button
                type="button"
                onClick={clearRecents}
                className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {recents.map((urlItem) => (
                <button
                  key={urlItem}
                  type="button"
                  onClick={() => {
                    setInputUrl(urlItem);
                    handleLaunch(urlItem);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/70 text-left text-xs font-mono text-zinc-300 hover:text-white truncate transition-colors cursor-pointer focus-visible:ring-2"
                >
                  <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{urlItem}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <footer id="footnote-info" className="mt-8 text-xs text-zinc-500 max-w-md space-y-1">
          <p>
            • <strong>HTML Embed:</strong> URL সরাসরি <code className="text-zinc-400 font-mono">index.html</code> ফাইলের ভেতরে সেভ করা আছে।
          </p>
          <p>
            • <strong>GitHub & Smart TV:</strong> কোনো বিল্ড টুল ছাড়াই যেকোনো প্ল্যাটফর্মে সরাসরি ব্ল্যাক ফুলস্ক্রিনে চলবে।
          </p>
        </footer>
      </div>
    </main>
  );
}
