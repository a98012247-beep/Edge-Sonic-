import React, { useState, useEffect, useRef } from 'react';
import { Play, Settings2, Download, AlertTriangle, Mic2, Search, Loader2, X } from 'lucide-react';
import { Voice } from './types';
import { cn } from './lib/utils';
import { motion } from 'framer-motion';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Female' | 'Male'>('All');
  const [localeFilter, setLocaleFilter] = useState<string>('All');
  
  // Modifiers
  const [speed, setSpeed] = useState(0); // -50 to +50
  const [pitch, setPitch] = useState(0); // -50 to +50
  
  // Output
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // Metrics
  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = wordCount / 150;
  const isOverLimit = estimatedMinutes > 30;

  // Session Tracker
  const [sessionMinutesUsed, setSessionMinutesUsed] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    fetch('/api/tts/voices', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setVoices(data);
        setFilteredVoices(data);
        if (data.length > 0) setSelectedVoice(data[0]);
      })
      .catch(err => console.error("Failed to load voices", err));
  }, []);

  useEffect(() => {
    let result = voices;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(v => 
        v.FriendlyName.toLowerCase().includes(s) || 
        v.ShortName.toLowerCase().includes(s) ||
        v.Locale.toLowerCase().includes(s)
      );
    }
    if (genderFilter !== 'All') {
      result = result.filter(v => v.Gender === genderFilter);
    }
    if (localeFilter !== 'All') {
      result = result.filter(v => v.Locale === localeFilter);
    }
    setFilteredVoices(result);
  }, [search, genderFilter, localeFilter, voices]);

  const allLocales = Array.from(new Set(voices.map(v => v.Locale)));

  const handleGenerate = async () => {
    if (!selectedVoice || !text.trim()) return;
    
    // Check limits
    if (sessionMinutesUsed + estimatedMinutes > 60) {
      setShowPremiumModal(true);
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice.ShortName,
          pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
          rate: `${speed >= 0 ? '+' : ''}${speed}%`
        })
      });
      
      if (!res.ok) throw new Error("Generation failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setSessionMinutesUsed(prev => prev + estimatedMinutes);
    } catch (err) {
      console.error(err);
      alert("Failed to generate audio. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async (voice: Voice) => {
    setIsPreviewing(true);
    try {
      const res = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voice.ShortName })
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 selection:bg-accent/40 selection:text-black flex flex-col items-center font-sans">
      
      {/* Header */}
      <header className="w-full max-w-7xl mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center text-black shadow-sm">
            <Mic2 size={20} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sonic<span className="text-white bg-bg-inverse px-2 py-0.5 rounded-lg ml-1">Edge</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex px-4 py-2 rounded-full bg-white shadow-sm border border-border-subtle text-sm items-center gap-2">
            <span className="text-text-muted">Session Usage:</span>
            <span className={cn(
              "font-bold", 
              sessionMinutesUsed > 45 ? "text-red-500" : "text-black"
            )}>
              {sessionMinutesUsed.toFixed(1)} / 60 min
            </span>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-border-subtle flex items-center justify-center text-text-main hover:bg-bg-main transition-colors"
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>

      <main className={cn(
        "w-full max-w-7xl flex-1 flex gap-6 transition-all",
        showSettings ? "xl:grid xl:grid-cols-[380px_1fr]" : "flex-col"
      )}>
        
        {/* Overlay for mobile drawer */}
        {showSettings && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 xl:hidden"
            onClick={() => setShowSettings(false)}
          />
        )}

        {/* Left Sidebar: Settings Panel (Drawer on Mobile) */}
        <aside className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-bg-main border-l border-border-subtle p-6 flex flex-col gap-6 h-full shadow-2xl transition-transform duration-300 overflow-y-auto custom-scrollbar",
          showSettings ? "translate-x-0" : "translate-x-full",
          "xl:static xl:translate-x-0 xl:w-auto xl:bg-transparent xl:border-none xl:p-0 xl:shadow-none xl:h-[calc(100vh-140px)]",
          !showSettings && "xl:hidden"
        )}>
          
          <div className="flex items-center justify-between xl:hidden shrink-0">
            <h2 className="text-xl font-bold text-text-main">Voice Settings</h2>
            <button 
              onClick={() => setShowSettings(false)}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-main shadow-sm border border-border-subtle"
            >
              <X size={20} />
            </button>
          </div>

          {/* Voice Search & Filter Box */}
          <div className="bg-white border border-border-subtle rounded-[24px] p-5 shadow-sm space-y-4 shrink-0">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Voice Library</h2>
            
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search voices..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-bg-main border-none rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all text-text-main placeholder:text-text-muted"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select 
                value={localeFilter}
                onChange={e => setLocaleFilter(e.target.value)}
                className="w-full bg-bg-main border-none rounded-xl py-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent appearance-none text-text-main"
              >
                <option value="All">All Locales</option>
                {allLocales.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              <select 
                value={genderFilter}
                onChange={e => setGenderFilter(e.target.value as any)}
                className="w-full bg-bg-main border-none rounded-xl py-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent appearance-none text-text-main"
              >
                <option value="All">All Genders</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          {/* Voice List */}
          <div className="bg-white border border-border-subtle rounded-[24px] overflow-hidden flex flex-col shadow-sm relative shrink-0">
            <div className="p-5 border-b border-border-subtle">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Available Voices</h2>
            </div>
            <div className="p-3 space-y-2">
              {filteredVoices.map(v => (
                <div
                  key={v.ShortName}
                  onClick={() => setSelectedVoice(v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVoice(v); }}
                  className={cn(
                    "w-full text-left px-4 py-4 rounded-2xl transition-all flex items-center justify-between group border border-transparent cursor-pointer",
                    selectedVoice?.ShortName === v.ShortName 
                      ? "bg-bg-inverse text-white shadow-md border-bg-inverse" 
                      : "hover:bg-bg-main bg-white text-text-main hover:border-border-subtle"
                  )}
                >
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      {v.FriendlyName}
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors",
                        selectedVoice?.ShortName === v.ShortName 
                          ? "bg-white/20 text-white" 
                          : "bg-bg-main text-text-muted group-hover:bg-white group-hover:border group-hover:border-border-subtle"
                      )}>
                        {v.Gender}
                      </span>
                    </div>
                    <div className={cn(
                      "text-xs mt-1 font-medium",
                      selectedVoice?.ShortName === v.ShortName ? "text-gray-400" : "text-text-muted"
                    )}>{v.Locale}</div>
                  </div>
                  
                  {selectedVoice?.ShortName === v.ShortName && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePreview(v); }}
                      disabled={isPreviewing}
                      className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-black hover:scale-105 transition-transform shadow-sm"
                      title="Play Preview"
                    >
                      {isPreviewing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="ml-1" fill="currentColor" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Output Customization */}
          <div className="bg-bg-inverse text-white rounded-[24px] p-6 shadow-xl grid grid-cols-1 gap-8 relative overflow-hidden shrink-0 mb-4 xl:mb-0">
            {/* Decorative background element for the "modern" feel */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                <label className="text-sm text-gray-400 font-medium">Speed / Rate</label>
                <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md text-accent">{speed > 0 ? '+' : ''}{speed}%</span>
              </div>
              <input 
                type="range" min="-50" max="50" value={speed} onChange={e => setSpeed(Number(e.target.value))}
                className="custom-range"
              />
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                <label className="text-sm text-gray-400 font-medium">Pitch</label>
                <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-md text-accent">{pitch > 0 ? '+' : ''}{pitch}Hz</span>
              </div>
              <input 
                type="range" min="-50" max="50" value={pitch} onChange={e => setPitch(Number(e.target.value))}
                className="custom-range"
              />
            </div>
          </div>

        </aside>

        {/* Right Content: Canvas */}
        <div className="space-y-6 flex flex-col flex-1 h-[calc(100vh-140px)]">
          
          {/* Text Canvas */}
          <div className="bg-white border border-border-subtle rounded-[24px] shadow-sm flex-1 flex flex-col relative overflow-hidden">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your long-form script here..."
              className="w-full flex-1 bg-transparent resize-none p-6 text-text-main placeholder:text-text-muted focus:outline-none text-base leading-relaxed font-medium"
            />
            
            {/* Status Footer */}
            <div className="border-t border-border-subtle bg-bg-main p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-text-muted font-medium">
                <div>Chars: <span className="text-text-main font-bold">{charCount.toLocaleString()}</span></div>
                <div>Words: <span className="text-text-main font-bold">{wordCount.toLocaleString()}</span></div>
                <div>Est. Audio: <span className={cn(
                  "font-bold", 
                  isOverLimit ? "text-red-500" : "text-text-main"
                )}>~{estimatedMinutes.toFixed(1)} min</span></div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim() || !selectedVoice}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                  isGenerating 
                    ? "bg-border-subtle text-text-muted cursor-not-allowed" 
                    : "bg-accent text-black hover:bg-[#c2e600] shadow-md hover:shadow-lg active:scale-95"
                )}
              >
                {isGenerating ? (
                  <><Loader2 size={18} className="animate-spin" /> Processing Chunked Audio...</>
                ) : (
                  <><Play size={18} fill="currentColor" /> Generate Master Track</>
                )}
              </button>
            </div>
            
            {isOverLimit && (
              <div className="absolute top-4 right-4 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                <AlertTriangle size={14} />
                Over 30m limit. Consider splitting script.
              </div>
            )}
          </div>

          {/* Audio Player Card */}
          {audioUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent text-black rounded-[24px] p-4 shadow-xl flex items-center gap-4 border border-[#c2e600]"
            >
              <div className="bg-white/80 rounded-2xl flex-1 px-4 py-2 backdrop-blur-sm">
                <audio src={audioUrl} controls className="w-full h-10 outline-none" />
              </div>
              <a 
                href={audioUrl}
                download="sonic-edge-export.mp3"
                className="w-12 h-12 shrink-0 rounded-2xl bg-bg-inverse flex items-center justify-center text-white hover:bg-black transition-colors shadow-md"
              >
                <Download size={20} />
              </a>
            </motion.div>
          )}

        </div>
      </main>

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden border border-border-subtle"
          >
            <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto text-black shadow-lg">
              <Settings2 size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-text-main mb-3">Usage Limit Reached</h3>
              <p className="text-text-muted text-sm leading-relaxed font-medium">
                You've hit the 60-minute session generation limit for the standard tier. Upgrade to SonicEdge Pro for unlimited batch generations, premium 48kHz exports, and Priority Queue.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 py-3.5 rounded-2xl bg-bg-main text-text-main font-bold hover:bg-border-subtle transition-colors"
              >
                Close
              </button>
              <button 
                className="flex-1 py-3.5 rounded-2xl bg-bg-inverse text-accent font-bold hover:bg-black shadow-xl transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
