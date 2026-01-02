
import React, { useState } from 'react';
import { useStore } from '../store';
import { X, Play, Video, Film } from 'lucide-react';

export const ExportModal: React.FC = () => {
    const { isExportModalOpen, setExportModalOpen, setIsExporting, setPlaying, isPlaying } = useStore();
    const [quality, setQuality] = useState('HIGH');
    const [fps, setFps] = useState('30');
    
    if (!isExportModalOpen) return null;

    const handleStartRender = () => {
        setExportModalOpen(false);
        setIsExporting(true);
    };

    const togglePreview = () => {
        setPlaying(!isPlaying);
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-glass-900 border border-white/10 rounded-2xl shadow-2xl w-[800px] h-[500px] flex overflow-hidden">
                
                {/* Preview Area - MUST BE TRANSPARENT FOR DREI VIEW */}
                <div className="flex-1 bg-transparent relative border-r border-white/10 group">
                    {/* The ID targeted by Viewport's View component */}
                    <div id="export-preview-view" className="w-full h-full"></div>
                    
                    {/* Preview Controls Overlay */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur rounded-full px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={togglePreview} className="text-white hover:text-accent flex items-center gap-2 text-sm font-medium">
                             {isPlaying ? "Pause Preview" : <><Play size={14} /> Play Preview</>}
                         </button>
                    </div>

                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-white/50 pointer-events-none">
                        Active Camera Preview
                    </div>
                </div>

                {/* Sidebar Settings */}
                <div className="w-72 p-6 flex flex-col bg-slate-900/50">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Film size={20} className="text-accent"/> Export
                        </h2>
                        <button 
                            onClick={() => { setExportModalOpen(false); setPlaying(false); }}
                            className="text-white/50 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase font-bold tracking-wider">Format</label>
                            <div className="p-3 bg-white/5 rounded border border-white/10 text-sm text-white/70">
                                Video (WebM / VP9)
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase font-bold tracking-wider">Frame Rate</label>
                            <div className="flex gap-2">
                                {['30', '60'].map(rate => (
                                    <button
                                        key={rate}
                                        onClick={() => setFps(rate)}
                                        className={`flex-1 py-2 text-sm rounded border transition-colors ${
                                            fps === rate 
                                            ? 'bg-accent/20 border-accent text-accent' 
                                            : 'bg-white/5 border-transparent text-white/50 hover:text-white'
                                        }`}
                                    >
                                        {rate} FPS
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-white/50 uppercase font-bold tracking-wider">Quality</label>
                            <div className="flex flex-col gap-2">
                                {['HIGH', 'MEDIUM', 'LOW'].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => setQuality(q)}
                                        className={`w-full text-left px-3 py-2 text-sm rounded border transition-colors ${
                                            quality === q 
                                            ? 'bg-accent/20 border-accent text-accent' 
                                            : 'bg-white/5 border-transparent text-white/50 hover:text-white'
                                        }`}
                                    >
                                        {q} Bitrate
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleStartRender}
                        className="w-full py-3 bg-accent hover:bg-white text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-colors mt-4"
                    >
                        <Video size={18} /> Start Render
                    </button>
                </div>

            </div>
        </div>
    );
};
