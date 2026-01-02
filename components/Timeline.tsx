
import React, { useRef, useState, useMemo } from 'react';
import { useStore } from '../store';
import { Play, Pause, Repeat, Plus, ChevronDown, Trash2, Clock, RotateCcw, Film } from 'lucide-react';
import { AnimationTrack, Keyframe } from '../types';

interface GroupedTrackItemProps {
    label: string;
    tracks: AnimationTrack[];
    width: number;
    maxDuration: number;
}

const GroupedTrackItem: React.FC<GroupedTrackItemProps> = ({ label, tracks, width, maxDuration }) => {
    const { selectKeyframe, selectedKeyframeIds, updateTrackKeyframes } = useStore();
    
    // Aggregate keyframes from all tracks in this group
    const allKeyframes = useMemo(() => {
        return tracks.flatMap(t => t.keyframes.map(k => ({ ...k, trackId: t.id })));
    }, [tracks]);

    // Group by time (approximate for floating point equality)
    const distinctTimes = useMemo(() => {
        const times = new Set<number>();
        allKeyframes.forEach(k => {
            const t = Math.round(k.time * 100) / 100;
            times.add(t);
        });
        return Array.from(times).sort((a, b) => a - b);
    }, [allKeyframes]);

    if (distinctTimes.length === 0) return (
        <div className="h-8 w-full flex items-center border-b border-white/5 relative bg-white/5 box-border">
             {/* Empty track visual guide */}
        </div>
    );

    const startTime = distinctTimes[0];
    const endTime = distinctTimes[distinctTimes.length - 1];
    const duration = endTime - startTime;

    // Helper: Convert time/pixels
    const t2px = (t: number) => (t / maxDuration) * width;
    const px2t = (px: number) => (px / width) * maxDuration;

    // --- Drag Logic for Bar (Move All Keyframes in Group) ---
    const handleBarMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        
        // Snapshot current state
        const trackSnapshots = tracks.map(t => ({
            id: t.id,
            keys: [...t.keyframes]
        }));

        const move = (ev: MouseEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaT = px2t(deltaX);

            trackSnapshots.forEach(snap => {
                const newKeys = snap.keys.map(k => ({
                    ...k,
                    time: Math.max(0, k.time + deltaT)
                }));
                updateTrackKeyframes(snap.id, newKeys);
            });
        };

        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    // --- Drag Logic for Keyframe (Move Single Timepoint) ---
    const handleKeyframeMouseDown = (e: React.MouseEvent, time: number) => {
        e.stopPropagation();
        
        // Select logic (simple toggle for visual feedback)
        const keysAtTime = allKeyframes.filter(k => Math.abs(k.time - time) < 0.05);
        const ids = keysAtTime.map(k => k.id);
        const isMulti = e.shiftKey || e.metaKey;
        ids.forEach((id, idx) => selectKeyframe(id, isMulti || idx > 0));

        const startX = e.clientX;
        const initialTime = time;
        const trackSnapshots = tracks.map(t => ({
            id: t.id,
            keys: [...t.keyframes]
        }));

        const move = (ev: MouseEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaT = px2t(deltaX);
            const newTime = Math.max(0, initialTime + deltaT);

            trackSnapshots.forEach(snap => {
                // Only move keys that started at 'initialTime'
                const keysToMove = snap.keys.filter(k => Math.abs(k.time - initialTime) < 0.05);
                if (keysToMove.length > 0) {
                     const newKeys = snap.keys.map(k => {
                         if (Math.abs(k.time - initialTime) < 0.05) {
                             return { ...k, time: newTime };
                         }
                         return k;
                     });
                     updateTrackKeyframes(snap.id, newKeys);
                }
            });
        };

        const up = () => {
             window.removeEventListener('mousemove', move);
             window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    // Determine if any key at a specific time is selected
    const isTimeSelected = (time: number) => {
        const keysAtTime = allKeyframes.filter(k => Math.abs(k.time - time) < 0.05);
        return keysAtTime.some(k => selectedKeyframeIds.includes(k.id));
    };

    return (
        <div className="h-8 w-full flex items-center relative group border-b border-white/5 hover:bg-white/5 transition-colors box-border">
             {/* Duration Bar */}
             {distinctTimes.length > 1 && (
                <div 
                    className="absolute h-1.5 bg-blue-500/30 rounded-full top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing hover:bg-blue-500/50"
                    style={{ left: `${(startTime / maxDuration) * 100}%`, width: `${(duration / maxDuration) * 100}%` }}
                    onMouseDown={handleBarMouseDown}
                ></div>
             )}

             {/* Keyframes (Diamonds) */}
             {distinctTimes.map(t => (
                 <div
                    key={t}
                    onMouseDown={(e) => handleKeyframeMouseDown(e, t)}
                    className={`absolute w-2.5 h-2.5 rotate-45 border border-black/50 cursor-pointer transition-all z-10 hover:scale-125 top-1/2 -translate-y-1/2
                        ${isTimeSelected(t)
                            ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
                            : 'bg-blue-500 hover:bg-blue-400'
                        }
                    `}
                    style={{ left: `calc(${(t / maxDuration) * 100}% - 5px)` }}
                 ></div>
             ))}
        </div>
    );
};

export const Timeline: React.FC = () => {
    const { currentTime, maxDuration, isPlaying, setPlaying, setCurrentTime, tracks, selectedId, removeKeyframes, selectedKeyframeIds, objects } = useStore();
    const rulerRef = useRef<HTMLDivElement>(null);
    const trackAreaRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    
    // Selected Object Info
    const selectedObject = objects.find(o => o.id === selectedId);

    // Group tracks by property category (Position, Rotation, Scale)
    const groupedTracks = useMemo(() => {
        if (!selectedId) return [];
        const objectTracks = tracks.filter(t => t.targetId === selectedId);
        
        const groups: { [key: string]: AnimationTrack[] } = {
            'Position': [],
            'Rotation': [],
            'Scale': []
        };

        objectTracks.forEach(t => {
            if (t.property.startsWith('position')) groups['Position'].push(t);
            else if (t.property.startsWith('rotation')) groups['Rotation'].push(t);
            else if (t.property.startsWith('scale')) groups['Scale'].push(t);
        });

        return Object.entries(groups).filter(([_, ts]) => ts.length > 0);
    }, [tracks, selectedId]);

    React.useEffect(() => {
        if (trackAreaRef.current) {
            const updateWidth = () => setWidth(trackAreaRef.current?.getBoundingClientRect().width || 0);
            updateWidth();
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }
    }, [trackAreaRef.current]);
    
    const calculateTime = (clientX: number, rect: DOMRect) => {
        const x = clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        return pct * maxDuration;
    };

    const handleInteraction = (clientX: number) => {
        if (rulerRef.current) {
            const rect = rulerRef.current.getBoundingClientRect();
            setCurrentTime(calculateTime(clientX, rect));
        }
    };

    const handleDelete = () => {
        if(selectedKeyframeIds.length > 0) {
            removeKeyframes(selectedKeyframeIds);
        }
    };

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedKeyframeIds, removeKeyframes]);
    
    // Check if active clip exists for selected object
    const activeClip = selectedObject?.activeAnimation;
    const clipDuration = activeClip && selectedObject.animationDurations ? selectedObject.animationDurations[activeClip] : 0;

    return (
        <div className="h-full bg-[#121212]/95 backdrop-blur-xl flex flex-col text-white select-none">
            
            {/* Header Row */}
            <div className="flex h-10 border-b border-white/10 bg-black/20">
                {/* Top-Left: Playback Controls (moved here) */}
                <div className="w-[200px] border-r border-white/10 flex items-center justify-between px-3 bg-white/5">
                    <button 
                        onClick={() => setPlaying(!isPlaying)}
                        className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors text-white"
                        title={isPlaying ? "Pause" : "Play"}
                    >
                         {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    </button>
                    
                    <div className="flex items-center gap-1.5 text-[10px] font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                         <Clock size={10} className="text-blue-400" />
                         <span className="text-blue-400 w-8 text-right">{currentTime.toFixed(2)}s</span>
                         <span className="text-zinc-500">/</span>
                         <span className="text-zinc-400">{maxDuration}s</span>
                    </div>

                    <button className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors text-zinc-400 hover:text-white" title="Loop">
                         <Repeat size={12} />
                    </button>
                </div>

                {/* Top-Right: Ruler (Aligned with timeline tracks) */}
                <div 
                    ref={rulerRef}
                    className="flex-1 relative cursor-pointer group bg-gradient-to-b from-white/5 to-transparent"
                    onMouseDown={(e) => {
                        handleInteraction(e.clientX);
                        const move = (ev: MouseEvent) => handleInteraction(ev.clientX);
                        const up = () => {
                            window.removeEventListener('mousemove', move);
                            window.removeEventListener('mouseup', up);
                        };
                        window.addEventListener('mousemove', move);
                        window.addEventListener('mouseup', up);
                    }}
                >
                     {/* Playhead Badge (Top) */}
                    <div 
                        className="absolute top-0 bottom-0 z-30 pointer-events-none transform -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${(currentTime / maxDuration) * 100}%` }}
                    >
                            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-500 translate-y-[2px]"></div>
                    </div>

                    {/* Ruler Ticks */}
                    <div className="absolute inset-0 flex justify-between items-end pb-0 px-2 pointer-events-none">
                        {[...Array(21)].map((_, i) => (
                            <div key={i} className="flex flex-col items-center justify-end h-full gap-0.5 relative">
                                <span className="text-[8px] text-zinc-600 font-medium mb-auto mt-1 select-none">
                                    {i % 2 === 0 ? (i/2) + 's' : ''}
                                </span>
                                <div className={`w-px bg-zinc-800 ${i % 2 === 0 ? 'h-2' : 'h-1.5'}`}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Area: Sidebar + Tracks */}
            <div className="flex-1 flex overflow-hidden">
                 
                 {/* Left Sidebar: Property Names */}
                 <div className="w-[200px] border-r border-white/10 bg-black/20 flex flex-col">
                     {selectedId ? (
                         <>
                             {/* Object Name Header - Matches height of spacers */}
                             <div className="h-[33px] px-3 flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5 bg-white/5">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="truncate">{selectedObject?.name || 'Object'}</span>
                             </div>

                             {/* Active Clip Row Header */}
                             {activeClip && (
                                <div className="h-8 px-4 flex items-center gap-2 text-[11px] text-purple-400 font-medium border-b border-white/5 bg-purple-500/5">
                                    <Film size={12} /> Active Clip
                                </div>
                             )}
                             
                             {groupedTracks.length > 0 ? (
                                 groupedTracks.map(([label]) => (
                                     <div key={label} className="h-8 px-4 flex items-center text-[11px] text-zinc-400 font-medium border-b border-white/5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer">
                                         {label}
                                     </div>
                                 ))
                             ) : (
                                 !activeClip && <div className="p-4 text-xs text-zinc-600 italic">No animations</div>
                             )}
                         </>
                     ) : (
                         <div className="p-4 text-xs text-zinc-600 italic">Select an object</div>
                     )}
                 </div>
                 
                 {/* Right Content: Tracks */}
                 <div className="flex-1 flex flex-col overflow-hidden bg-black/40 relative">
                     {/* Playhead Line */}
                     <div 
                        className="absolute top-0 bottom-0 w-px bg-blue-500/50 z-20 pointer-events-none shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ left: `${(currentTime / maxDuration) * 100}%` }}
                    ></div>

                     {/* Grid lines */}
                     <div className="absolute inset-0 pointer-events-none flex justify-between px-2 opacity-20">
                         {[...Array(21)].map((_, i) => (
                             <div key={i} className="h-full w-px bg-zinc-700"></div>
                         ))}
                     </div>

                     <div ref={trackAreaRef} className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                         {/* Spacer to align first track with Sidebar properties, skipping the Object Name header */}
                         {selectedId && <div className="h-[33px] w-full border-b border-white/5"></div>}
                         
                         {/* Active Clip Track Visualization */}
                         {selectedId && activeClip && clipDuration > 0 && (
                             <div className="h-8 w-full flex items-center border-b border-white/5 bg-purple-500/5 relative group">
                                 <div 
                                    className="absolute h-5 top-1.5 bg-purple-500/30 border border-purple-500/50 rounded flex items-center px-2"
                                    style={{ left: 0, width: `${(clipDuration / maxDuration) * 100}%` }}
                                 >
                                     <span className="text-[9px] text-purple-200 truncate font-mono">{activeClip} ({clipDuration.toFixed(2)}s)</span>
                                 </div>
                             </div>
                         )}

                         {selectedId && groupedTracks.length > 0 && (
                             groupedTracks.map(([label, groupTracks]) => (
                                <GroupedTrackItem 
                                    key={label} 
                                    label={label}
                                    tracks={groupTracks} 
                                    width={width}
                                    maxDuration={maxDuration}
                                />
                             ))
                         )}
                     </div>
                 </div>
            </div>
        </div>
    );
};
