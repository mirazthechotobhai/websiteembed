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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(false); // Starts hidden for pristine edge-to-edge full screen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [editUrlInput, setEditUrlInput] = useState<string>('');
  const [recents, setRecents] = useState<string[]>([]);

  // Multi-layer and device display settings
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [tvOverscanPadding, setTvOverscanPadding] = useState<number>(0);
  const [enableSandbox, setEnableSandbox] = useState<boolean>(false); // Unrestricted native mode for full video & multi-layer playback
  const [autoHideToolbar, setAutoHideToolbar] = useState<boolean>(true);

  const hideTimerRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        if (typeof parsed.enableSandbox === 'boolean') setEnableSandbox(parsed.enableSandbox);
        if (typeof parsed.autoHideToolbar === 'boolean') setAutoHideToolbar(parsed.autoHideToolbar);
      }
    } catch {
      // Ignore localstorage errors
    }
  }, []);

  const saveSettings = (newSettings: {
    zoomLevel: number;
    tvOverscanPadding: number;
    enableSandbox: boolean;
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

  // Check URL query parameters or default to user's URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('url');
    const hashUrl = window.location.hash ? window.location.hash.slice(1) : '';

    const target = queryUrl || hashUrl || TARGET_DEFAULT_URL;
    if (target) {
      const formatted = formatUrl(target);
      setActiveUrl(formatted);
      setInputUrl(formatted);
      setIsLoading(true);
      saveToRecents(formatted);
    }
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

  // Smart TV Remote & Keyboard controller
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // TV Remote keys:
      // Tizen Back: 10009
      // webOS Back: 461
      // Android Back: 4
      // Standard Escape: 27 / 'Escape'
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
          // Toggle toolbar visibility
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
  }, [showEditModal, showSettingsModal, activeUrl, autoHideToolbar]);

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

  const handleLaunch = (targetUrl?: string) => {
    const toLaunch = targetUrl || inputUrl;
    const formatted = formatUrl(toLaunch);
    if (!formatted) return;

    setActiveUrl(formatted);
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
    saveToRecents(formatted);

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
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // Ignore
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
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
      // Fullscreen not supported or blocked
    }
  };

  const handleOpenExternal = () => {
    if (activeUrl) {
      window.open(activeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Full Screen Web View with Multi-Layer Support
  if (activeUrl) {
    return (
      <main
        id="fullscreen-iframe-container"
        onMouseMove={autoHideToolbar ? revealControlsTemporarily : undefined}
        onTouchStart={autoHideToolbar ? revealControlsTemporarily : undefined}
        className="fixed inset-0 w-screen h-screen h-[100dvh] overflow-hidden bg-black select-none m-0 p-0"
      >
        {/* Frame Wrapper with TV Overscan Padding and Scale Zoom support */}
        <div
          id="iframe-scaler-wrapper"
          className="w-full h-full relative transition-all duration-200 ease-out m-0 p-0"
          style={{
            padding: tvOverscanPadding > 0 ? `${tvOverscanPadding}vh ${tvOverscanPadding}vw` : '0px',
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
            transformOrigin: 'center center',
          }}
        >
          {/* 
            Multi-Layer Native Support:
            - Full Permissive Allow String (Autoplay, Fullscreen, Media, DRM, WebGL, Canvas, Audio, Picture-in-picture)
            - Optional Sandbox: When disabled (default), all multi-layer DOM, video player layers, canvas, and Web Workers work natively
          */}
          <iframe
            id="fullscreen-webview-iframe"
            key={`${iframeKey}-${enableSandbox}`}
            ref={iframeRef}
            src={activeUrl}
            title="Movie Lover TV Web View"
            className="w-full h-full border-0 bg-black block"
            allow="accelerometer; ambient-light-sensor; autoplay; battery; camera; clipboard-read; clipboard-write; display-capture; document-domain; encrypted-media; execution-while-not-rendered; execution-while-out-of-viewport; fullscreen; geolocation; gyroscope; hid; idle-detection; magnetometer; microphone; midi; navigation-override; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; speaker-selection; sync-xhr; usb; web-share; xr-spatial-tracking"
            {...(enableSandbox
              ? {
                  sandbox:
                    'allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation allow-top-navigation-by-user-activation allow-storage-access-by-user-activation',
                }
              : {})}
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={() => {
              setIsLoading(false);
            }}
          />
        </div>

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

        {/* Floating Top Control Bar (Auto-hides to maintain 100% borderless clean display) */}
        <header
          id="floating-control-bar"
          className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-in-out max-w-[96vw] ${
            isControlsVisible
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-16 opacity-0 pointer-events-none'
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

            {/* Open in new tab button */}
            <button
              id="btn-open-external"
              type="button"
              onClick={handleOpenExternal}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Open in new window / external browser"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Display / Device / Layer Settings */}
            <button
              id="btn-display-settings"
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-xs font-medium rounded-xl hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-zinc-300 focus-visible:ring-2"
              title="Device, Zoom & Multi-Layer Settings"
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

            {/* Reset / Blank page button */}
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

        {/* Small floating trigger button at top right when toolbar is hidden */}
        {!isControlsVisible && (
          <button
            id="btn-restore-bar"
            type="button"
            onClick={() => {
              setIsControlsVisible(true);
              if (autoHideToolbar) revealControlsTemporarily();
            }}
            className="fixed top-2 right-3 z-40 p-2 rounded-full bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 shadow-xl backdrop-blur-md opacity-30 hover:opacity-100 transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2"
            title="Show Controls (or press Remote Back/Escape)"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Change URL Modal */}
        {showEditModal && (
          <div
            id="modal-change-url"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
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

        {/* Display & Multi-layer Settings Modal */}
        {showSettingsModal && (
          <div
            id="modal-settings"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
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
                {/* Multi-layer compatibility mode */}
                <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium text-zinc-200">Multi-Layer Compatibility</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium">
                      {enableSandbox ? 'Sandboxed' : 'Unrestricted Native'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                    Unrestricted mode allows full support for multi-layer WebGL canvases, video overlays, popups, and workers.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEnableSandbox(false);
                        saveSettings({ zoomLevel, tvOverscanPadding, enableSandbox: false, autoHideToolbar });
                      }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                        !enableSandbox
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      Unrestricted (Full Layer)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEnableSandbox(true);
                        saveSettings({ zoomLevel, tvOverscanPadding, enableSandbox: true, autoHideToolbar });
                      }}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                        enableSandbox
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      Strict Sandbox
                    </button>
                  </div>
                </div>

                {/* Smart TV Overscan compensation */}
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
                          saveSettings({ zoomLevel, tvOverscanPadding: pad, enableSandbox, autoHideToolbar });
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

                {/* Zoom / Scaling for High DPI TV or mobile */}
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
                        saveSettings({ zoomLevel: newZ, tvOverscanPadding, enableSandbox, autoHideToolbar });
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
                        saveSettings({ zoomLevel: val, tvOverscanPadding, enableSandbox, autoHideToolbar });
                      }}
                      className="flex-1 accent-indigo-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newZ = Math.min(150, zoomLevel + 10);
                        setZoomLevel(newZ);
                        saveSettings({ zoomLevel: newZ, tvOverscanPadding, enableSandbox, autoHideToolbar });
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
                        saveSettings({ zoomLevel: 100, tvOverscanPadding, enableSandbox, autoHideToolbar });
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      100%
                    </button>
                  </div>
                </div>

                {/* Auto-hide toolbar toggle */}
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
                      saveSettings({ zoomLevel, tvOverscanPadding, enableSandbox, autoHideToolbar: nextVal });
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
      </main>
    );
  }

  // Blank clean landing view (displayed if user clicks close)
  return (
    <main
      id="blank-fullscreen-view"
      className="fixed inset-0 w-screen h-screen h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-zinc-950 text-zinc-100 overflow-y-auto"
    >
      <div className="w-full max-w-xl flex flex-col items-center text-center my-auto">
        {/* Device Compatibility Icon Row */}
        <div id="device-support-badge" className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg"
            title="Movie Lover TV"
          >
            <Film className="w-5 h-5 text-indigo-400" />
          </div>
          <div
            className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg"
            title="Smart TV Ready"
          >
            <Tv className="w-5 h-5 text-cyan-400" />
          </div>
          <div
            className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg"
            title="Mobile & Emulator Ready"
          >
            <Smartphone className="w-5 h-5 text-purple-400" />
          </div>
          <div
            className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg"
            title="Multi-Layer Ready"
          >
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <h1
          id="main-heading"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2"
        >
          Movie Lover TV Web Viewer
        </h1>
        <p
          id="main-subtext"
          className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed"
        >
          Smart TV, Mobile, Emulator এবং যেকোনো ডিভাইসের জন্য মাল্টি-লেয়ার ফুল স্ক্রিন ওয়েব ভিউ।
        </p>

        {/* Primary 1-Click Launch Button for Movie Lover TV */}
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

        {/* Quick Sample Presets */}
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

        {/* Recent URLs history for Smart TV & Mobile quick click */}
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

        {/* Device hints & Smart TV remote help */}
        <footer id="footnote-info" className="mt-8 text-xs text-zinc-500 max-w-md space-y-1">
          <p>
            • <strong>Smart TV & Remote:</strong> রিমোটের <code className="text-zinc-400 font-mono">Back / Escape</code> চেপে যেকোনো সময় কন্ট্রোল মেনু টগল করা যাবে।
          </p>
          <p>
            • <strong>Multi-Layer & Video:</strong> অটোপ্লে, ফুলস্ক্রিন, ভিডিও ওভারলে এবং পপআপ লেয়ার অক্ষুণ্ণ থাকবে।
          </p>
        </footer>
      </div>
    </main>
  );
}
