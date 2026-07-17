'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Search, Play, X, Link2, Loader2, Check, AlertTriangle } from 'lucide-react';

interface LinkedVideo {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
}

interface VideoSectionProps {
  phoneId: string | null;
  linkedVideos: LinkedVideo[];
  onLink: (videoId: string) => void;
  onUnlink: (videoId: string) => void;
}

export default function VideoSection({ phoneId, linkedVideos, onLink, onUnlink }: VideoSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; youtubeId: string; title: string; thumbnailUrl: string;
    active: boolean; autoLinked: boolean; phoneId: string | null; phoneName: string | null;
  }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupSuccess, setLookupSuccess] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Autocomplete search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/videos/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        const data = await res.json();
        setSearchResults(data.videos || []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, []);

  // Paste YouTube URL to fetch/create video
  const handleUrlLookup = async () => {
    const input = urlInput.trim();
    if (!input) return;
    setLookingUp(true);
    setLookupError('');
    setLookupSuccess('');
    try {
      const res = await fetch('/api/admin/videos/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ youtubeUrl: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'Failed to look up video');
        return;
      }
      // Link this video to the phone
      onLink(data.id);
      setLookupSuccess(data.alreadyExisted ? `Linked existing video: ${data.title}` : `Fetched & linked: ${data.title}`);
      setUrlInput('');
    } catch {
      setLookupError('Network error');
    } finally {
      setLookingUp(false);
    }
  };

  // Check if a video is already linked to this phone
  const isLinked = (videoId: string) => linkedVideos.some(v => v.id === videoId);

  return (
    <div className="space-y-6">
      {/* Already linked videos */}
      {linkedVideos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Linked Video Reviews</h3>
          <div className="space-y-2">
            {linkedVideos.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" unoptimized />}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play className="w-4 h-4 text-white" fill="currentColor" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.youtubeId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUnlink(v.id)}
                  className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                  title="Unlink video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search autocomplete */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Search Synced Videos</h3>
        <p className="text-xs text-muted-foreground mb-3">Search by title to find videos already synced from your YouTube channel.</p>
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Type to search videos..."
              className="w-full h-10 pl-10 pr-10 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
          </div>

          {/* Dropdown results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map(v => {
                const linked = isLinked(v.id);
                const takenByOther = v.phoneId && !linked;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!!(linked || takenByOther)}
                    onClick={() => { onLink(v.id); setShowDropdown(false); setSearchQuery(''); }}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${linked ? 'opacity-50 cursor-default' : takenByOther ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="relative w-16 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                      {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} width={64} height={40} className="object-cover w-full h-full" unoptimized />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{v.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {linked && <span className="text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Linked</span>}
                        {takenByOther && <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Linked to: {v.phoneName}</span>}
                        {!linked && !takenByOther && (
                          <>
                            {!v.active && <span className="text-amber-600 mr-1">Inactive</span>}
                            {v.autoLinked && <span className="text-amber-600 mr-1">Auto-linked</span>}
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Paste YouTube URL */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Paste YouTube URL</h3>
        <p className="text-xs text-muted-foreground mb-3">Paste a YouTube video URL or ID to fetch it and link it to this phone. Creates a new record if not yet synced.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setLookupError(''); setLookupSuccess(''); }}
              onKeyDown={e => e.key === 'Enter' && handleUrlLookup()}
              placeholder="https://youtube.com/watch?v=... or video ID"
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={handleUrlLookup}
            disabled={lookingUp || !urlInput.trim()}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {lookingUp ? 'Fetching...' : 'Fetch & Link'}
          </button>
        </div>
        {lookupError && <p className="text-xs text-red-600 mt-2">{lookupError}</p>}
        {lookupSuccess && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><Check className="w-3 h-3" />{lookupSuccess}</p>}
      </div>
    </div>
  );
}