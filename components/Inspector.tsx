
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { ChevronDown, Video, ChevronRight, Maximize2, SlidersHorizontal, Activity, Bone, Plus, Trash2, Eye, EyeOff, GripVertical, Droplet, Sparkles, Layers, Box, Circle, Hexagon, Zap, Scan, Ghost, Sun, Camera, Aperture, Image as ImageIcon, Film, Lightbulb } from 'lucide-react';
import { ObjectType, MaterialLayer, MaterialLayerType, LightType, ProjectionType, WrappingType, SharpnessType, LightingModel, DepthOrigin, DepthType, DepthPositionMode, GradientStop, ToonPosition } from '../types';

const SectionHeader: React.FC<{ title: string; isOpen?: boolean }> = ({ title, isOpen = true }) => (
    <div className="flex items-center gap-2 py-3 px-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
        <ChevronDown size={10} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} /> 
        <span className="group-hover:text-zinc-300">{title}</span>
    </div>
);

const PropertyRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between mb-2.5 px-1 min-h-[24px]">
        <label className="text-xs text-zinc-500 font-medium truncate pr-2 w-24">{label}</label>
        <div className="flex items-center gap-2 flex-1 justify-end">{children}</div>
    </div>
);

const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; label?: string; step?: number, min?: number, max?: number }> = ({ value, onChange, label, step = 0.1, min, max }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value !== undefined ? value.toString() : '0');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startValue = useRef(0);
    const accumulatedMovement = useRef(0);

    // Update display when external value changes
    useEffect(() => {
        if (!isEditing) {
            setInputValue(value !== undefined ? Number(value).toFixed(2) : '0.00');
        }
    }, [value, isEditing]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditing) return;
        
        e.preventDefault();
        startValue.current = value || 0;
        accumulatedMovement.current = 0;
        isDragging.current = false;

        // Request Pointer Lock for infinite dragging
        const container = containerRef.current;
        if(container) {
            container.requestPointerLock();
        }

        const handleMouseMove = (ev: MouseEvent) => {
            // Use movementX which works seamlessly with pointer lock
            const { movementX } = ev;
            accumulatedMovement.current += movementX;

            // Threshold to start dragging
            if (!isDragging.current && Math.abs(accumulatedMovement.current) > 2) {
                isDragging.current = true;
            }

            if (isDragging.current) {
                const multiplier = ev.shiftKey ? 0.1 : (ev.ctrlKey ? 10 : 1);
                // Sensitivity
                const change = accumulatedMovement.current * (step || 0.1) * multiplier;
                let newValue = startValue.current + change;

                if (min !== undefined) newValue = Math.max(min, newValue);
                if (max !== undefined) newValue = Math.min(max, newValue);

                onChange(newValue);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.exitPointerLock();

            if (!isDragging.current) {
                setIsEditing(true);
                // Need raw value for editing, not fixed
                setInputValue(value !== undefined ? value.toString() : '0');
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.select();
                    }
                }, 10);
            }
            isDragging.current = false;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleBlur = () => {
        setIsEditing(false);
        const num = parseFloat(inputValue);
        if (!isNaN(num)) {
            let final = num;
            if (min !== undefined) final = Math.max(min, final);
            if (max !== undefined) final = Math.min(max, final);
            onChange(final);
            setInputValue(final.toFixed(2));
        } else {
            setInputValue((value || 0).toFixed(2));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <div 
            ref={containerRef}
            className="relative w-full group cursor-ew-resize bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 rounded transition-colors"
            onMouseDown={handleMouseDown}
        >
            {label && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-600 font-bold pointer-events-none group-hover:text-zinc-500 z-10">{label}</span>}
            
            {isEditing ? (
                <input 
                    ref={inputRef}
                    type="text" 
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={`w-full bg-transparent border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none text-right ${label ? 'pl-5' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            ) : (
                <div className={`w-full px-2 py-1 text-xs text-zinc-300 group-hover:text-white text-right select-none ${label ? 'pl-5' : ''}`}>
                    {Number(value || 0).toFixed(2)}
                </div>
            )}
        </div>
    );
}

const Toggle: React.FC<{ checked: boolean; onChange?: () => void }> = ({ checked, onChange }) => (
    <div 
        onClick={onChange}
        className={`w-8 h-4.5 rounded-full p-0.5 cursor-pointer transition-colors ${checked ? 'bg-blue-600' : 'bg-white/10'}`}
    >
        <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0'}`} />
    </div>
);

const ColorPicker: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => (
    <div className="flex items-center gap-2 w-full bg-white/5 rounded border border-transparent hover:border-white/20 p-1 cursor-pointer group relative overflow-hidden">
        <input 
            type="color" 
            value={color} 
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="w-4 h-4 rounded bg-[#2d2e32] border border-zinc-700 shadow-sm" style={{ backgroundColor: color }}></div>
        <span className="flex-1 text-xs text-zinc-400 group-hover:text-white uppercase font-mono">{color}</span>
    </div>
);

const Dropdown: React.FC<{ value: string; options: string[]; onChange: (v: string) => void }> = ({ value, options, onChange }) => (
    <div className="relative w-full">
        <select 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 rounded px-2 py-1 text-xs text-zinc-300 focus:text-white outline-none appearance-none cursor-pointer transition-colors"
        >
            {options.map(opt => (
                <option key={opt} value={opt} className="bg-[#1c1c1c] text-zinc-300">{opt}</option>
            ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <ChevronDown size={10} />
        </div>
    </div>
);

// --- Gradient Ramp Editor ---
const GradientRamp: React.FC<{ 
    stops: GradientStop[]; 
    onChange: (stops: GradientStop[]) => void;
    activeStopId: string | null;
    onSelectStop: (id: string | null) => void;
}> = ({ stops, onChange, activeStopId, onSelectStop }) => {
    const rampRef = useRef<HTMLDivElement>(null);

    const handleRampClick = (e: React.MouseEvent) => {
        if (!rampRef.current) return;
        const rect = rampRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const offset = Math.max(0, Math.min(1, x / rect.width));
        
        // Add new stop
        const newStop: GradientStop = {
            id: crypto.randomUUID(),
            color: '#ffffff',
            offset
        };
        onChange([...stops, newStop].sort((a,b) => a.offset - b.offset));
        onSelectStop(newStop.id);
    };

    const handleDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onSelectStop(id);
        const startX = e.clientX;
        const rect = rampRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const stop = stops.find(s => s.id === id);
        if(!stop) return;
        const startOffset = stop.offset;

        const move = (ev: MouseEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaOffset = deltaX / rect.width;
            const newOffset = Math.max(0, Math.min(1, startOffset + deltaOffset));
            
            const updatedStops = stops.map(s => s.id === id ? { ...s, offset: newOffset } : s);
            onChange(updatedStops.sort((a,b) => a.offset - b.offset));
        };

        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    const handleDeleteStop = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (stops.length <= 2) return; // Prevent deleting last 2 stops
        onChange(stops.filter(s => s.id !== id));
        if (activeStopId === id) onSelectStop(null);
    };

    const gradientString = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`;

    return (
        <div className="relative h-8 w-full mb-4 select-none group">
            <div 
                ref={rampRef}
                className="w-full h-4 rounded bg-zinc-700 cursor-crosshair border border-white/10" 
                style={{ background: gradientString }}
                onClick={handleRampClick}
            />
            {stops.map(stop => (
                <div
                    key={stop.id}
                    onMouseDown={(e) => handleDragStart(e, stop.id)}
                    onContextMenu={(e) => { e.preventDefault(); handleDeleteStop(e, stop.id); }}
                    className={`absolute top-0 w-3 h-6 -ml-1.5 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 flex flex-col items-center`}
                    style={{ left: `${stop.offset * 100}%` }}
                >
                    <div className={`w-3 h-3 rounded-full border-2 bg-white shadow-sm ${activeStopId === stop.id ? 'border-blue-500 scale-125' : 'border-zinc-500'}`} style={{ backgroundColor: stop.color }}></div>
                    <div className="w-0.5 h-3 bg-white/50"></div>
                </div>
            ))}
        </div>
    );
};

// --- Material System Components ---

const MaterialIcon: React.FC<{ type: MaterialLayerType }> = ({ type }) => {
    switch (type) {
        case 'COLOR': return <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><Droplet size={12} className="text-white" /></div>;
        case 'GRADIENT': return <div className="w-6 h-6 rounded bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center"><Box size={12} className="text-white" /></div>;
        case 'NOISE': return <div className="w-6 h-6 rounded bg-zinc-700 flex items-center justify-center"><Activity size={12} className="text-zinc-300" /></div>;
        case 'GLASS': return <div className="w-6 h-6 rounded bg-blue-300/20 border border-blue-300/40 flex items-center justify-center"><Ghost size={12} className="text-blue-200" /></div>;
        case 'OUTLINE': return <div className="w-6 h-6 rounded border-2 border-zinc-500 flex items-center justify-center"><Circle size={10} className="text-zinc-500" /></div>;
        case 'TOON': return <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center"><Sun size={12} className="text-black" /></div>;
        case 'MATCAP': return <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center"><Scan size={12} className="text-white" /></div>;
        case 'IMAGE': return <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center"><ImageIcon size={12} className="text-white" /></div>;
        case 'LIGHTING': return <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center"><Lightbulb size={12} className="text-white" /></div>;
        case 'DEPTH': return <div className="w-6 h-6 rounded bg-gradient-to-b from-gray-200 to-black flex items-center justify-center"><Box size={12} className="text-black" /></div>;
        case 'FRESNEL': return <div className="w-6 h-6 rounded bg-white/20 ring-1 ring-white/50 flex items-center justify-center"><Circle size={12} className="text-white" /></div>;
        default: return <div className="w-6 h-6 rounded bg-zinc-700"></div>;
    }
}

const MaterialLayerRow: React.FC<{ 
    layer: MaterialLayer; 
    onUpdate: (updates: Partial<MaterialLayer>) => void;
    onDelete: () => void;
    onExpand: () => void;
}> = ({ layer, onUpdate, onDelete, onExpand }) => {
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeStopId, setActiveStopId] = useState<string | null>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            onUpdate({ imageUrl: url });
        }
    };

    const handleStopColorChange = (color: string) => {
        const targetStops = layer.type === 'TOON' ? layer.toonGradientStops : layer.gradientStops;
        if (!activeStopId || !targetStops) return;
        
        const newStops = targetStops.map(s => s.id === activeStopId ? { ...s, color } : s);
        
        if (layer.type === 'TOON') {
            onUpdate({ toonGradientStops: newStops });
        } else {
            onUpdate({ gradientStops: newStops });
        }
    };

    const targetStops = layer.type === 'TOON' ? layer.toonGradientStops : layer.gradientStops;
    const activeStop = targetStops?.find(s => s.id === activeStopId);

    return (
        <div className="bg-[#1c1c1c] rounded-lg mb-2 overflow-hidden border border-transparent hover:border-white/10 transition-all">
            {/* Header Row */}
            <div className="flex items-center p-2 gap-3 group">
                <div onClick={onExpand} className="cursor-pointer">
                    <MaterialIcon type={layer.type} />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={onExpand}>
                    <span className="text-xs font-medium text-zinc-200 truncate">{layer.name}</span>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <NumberInput 
                        value={layer.opacity} 
                        onChange={(v) => onUpdate({ opacity: Math.max(0, Math.min(100, v)) })} 
                        max={100}
                        label="%"
                     />
                     <button onClick={() => onUpdate({ visible: !layer.visible })} className="text-zinc-500 hover:text-white">
                         {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                     </button>
                     <button onClick={onDelete} className="text-zinc-500 hover:text-red-400">
                         <Trash2 size={12} />
                     </button>
                </div>
            </div>

            {/* Expanded Settings */}
            {layer.expanded && (
                <div className="px-2 pb-3 pt-1 border-t border-white/5 bg-black/20 space-y-2 animate-in slide-in-from-top-1 duration-150">
                     
                     {/* ... (Existing IMAGE Logic) ... */}
                     {layer.type === 'IMAGE' && (
                         <>
                            <div className="flex items-center bg-black/40 rounded-lg p-1 mb-2 border border-white/5">
                                <button 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${layer.imageMode === 'MASK' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    onClick={() => onUpdate({ imageMode: 'MASK' })}
                                >
                                    Mask
                                </button>
                                <button 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${layer.imageMode === 'COLOR' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    onClick={() => onUpdate({ imageMode: 'COLOR' })}
                                >
                                    Color
                                </button>
                            </div>

                            <div className="relative w-full aspect-video bg-white/5 rounded-lg border border-dashed border-white/20 hover:border-white/40 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden group mb-2"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {layer.imageUrl ? (
                                    <>
                                        <img src={layer.imageUrl} alt="Texture" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-xs text-white font-medium">Change Image</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xs text-zinc-500 font-medium">Upload</span>
                                    </>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>

                            <button className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 mb-3 shadow-lg shadow-purple-900/20 transition-all">
                                <Sparkles size={12} /> Generate with AI
                            </button>

                            <PropertyRow label="Projection">
                                <Dropdown 
                                    value={layer.projection || 'UV'} 
                                    options={['UV', 'PLANAR', 'SPHERICAL', 'CYLINDRICAL', 'TRIPLANAR']} 
                                    onChange={(v) => onUpdate({ projection: v as ProjectionType })} 
                                />
                            </PropertyRow>

                            <PropertyRow label="Wrapping">
                                <Dropdown 
                                    value={layer.wrapping || 'REPEAT'} 
                                    options={['CLAMP', 'REPEAT', 'MIRROR']} 
                                    onChange={(v) => onUpdate({ wrapping: v as WrappingType })} 
                                />
                            </PropertyRow>

                            <PropertyRow label="Sharpness">
                                <Dropdown 
                                    value={layer.sharpness || 'SMOOTH'} 
                                    options={['SMOOTH', 'PIXELATED']} 
                                    onChange={(v) => onUpdate({ sharpness: v as SharpnessType })} 
                                />
                            </PropertyRow>

                            <PropertyRow label="Crop">
                                <div className="flex bg-white/5 rounded border border-white/10 p-0.5">
                                    <button 
                                        className={`px-3 py-0.5 text-[10px] rounded transition-colors ${layer.crop ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}
                                        onClick={() => onUpdate({ crop: true })}
                                    >
                                        Yes
                                    </button>
                                    <button 
                                        className={`px-3 py-0.5 text-[10px] rounded transition-colors ${!layer.crop ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}
                                        onClick={() => onUpdate({ crop: false })}
                                    >
                                        No
                                    </button>
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Scale">
                                <div className="flex gap-1">
                                    <NumberInput label="X" value={layer.scaleX || 1} onChange={(v) => onUpdate({ scaleX: v })} />
                                    <NumberInput label="Y" value={layer.scaleY || 1} onChange={(v) => onUpdate({ scaleY: v })} />
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Offset">
                                <div className="flex gap-1">
                                    <NumberInput label="X" value={layer.offsetX || 0} onChange={(v) => onUpdate({ offsetX: v })} />
                                    <NumberInput label="Y" value={layer.offsetY || 0} onChange={(v) => onUpdate({ offsetY: v })} />
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Rotation">
                                <NumberInput value={layer.rotation || 0} onChange={(v) => onUpdate({ rotation: v })} step={1} />
                            </PropertyRow>
                         </>
                     )}
                     
                     {/* ... (Existing LIGHTING Logic) ... */}
                     {layer.type === 'LIGHTING' && (
                         <>
                            <PropertyRow label="Type">
                                <Dropdown 
                                    value={layer.lightingType || 'PHYSICAL'} 
                                    options={['LAMBERT', 'PHONG', 'PHYSICAL', 'TOON']} 
                                    onChange={(v) => onUpdate({ lightingType: v as LightingModel })} 
                                />
                            </PropertyRow>
                            
                            {layer.lightingType === 'PHONG' && (
                                <>
                                    <PropertyRow label="Shininess">
                                        <NumberInput value={layer.shininess || 30} onChange={(v) => onUpdate({ shininess: v })} step={1} />
                                    </PropertyRow>
                                    <PropertyRow label="Specular">
                                        <ColorPicker color={layer.specularColor || '#111111'} onChange={(c) => onUpdate({ specularColor: c })} />
                                    </PropertyRow>
                                </>
                            )}

                            {layer.lightingType === 'PHYSICAL' && (
                                <>
                                    <PropertyRow label="Metalness">
                                        <NumberInput value={layer.metalness || 0} onChange={(v) => onUpdate({ metalness: v })} step={0.05} max={1} />
                                    </PropertyRow>
                                    <PropertyRow label="Roughness">
                                        <NumberInput value={layer.roughness || 0.5} onChange={(v) => onUpdate({ roughness: v })} step={0.05} max={1} />
                                    </PropertyRow>
                                    <PropertyRow label="Clearcoat">
                                        <NumberInput value={layer.clearcoat || 0} onChange={(v) => onUpdate({ clearcoat: v })} step={0.05} max={1} />
                                    </PropertyRow>
                                    <PropertyRow label="Clearcoat Rough">
                                        <NumberInput value={layer.clearcoatRoughness || 0} onChange={(v) => onUpdate({ clearcoatRoughness: v })} step={0.05} max={1} />
                                    </PropertyRow>
                                </>
                            )}
                         </>
                     )}

                     {/* ... (Existing DEPTH Logic) ... */}
                     {layer.type === 'DEPTH' && (
                         <>
                            <div className="mb-2">
                                <GradientRamp 
                                    stops={layer.gradientStops || []} 
                                    onChange={(stops) => onUpdate({ gradientStops: stops })} 
                                    activeStopId={activeStopId}
                                    onSelectStop={setActiveStopId}
                                />
                                {activeStop && (
                                    <PropertyRow label="Stop Color">
                                        <ColorPicker color={activeStop.color} onChange={handleStopColorChange} />
                                        <span className="text-[10px] text-zinc-500 w-8 text-right">{Math.round(activeStop.offset * 100)}%</span>
                                    </PropertyRow>
                                )}
                            </div>

                            <PropertyRow label="Origin">
                                <Dropdown 
                                    value={layer.depthOrigin || 'VECTOR'} 
                                    options={['VECTOR', 'CAMERA']} 
                                    onChange={(v) => onUpdate({ depthOrigin: v as DepthOrigin })} 
                                />
                            </PropertyRow>

                            <PropertyRow label="Type">
                                <Dropdown 
                                    value={layer.depthType || 'RADIAL'} 
                                    options={['LINEAR', 'RADIAL']} 
                                    onChange={(v) => onUpdate({ depthType: v as DepthType })} 
                                />
                            </PropertyRow>

                            <PropertyRow label="Position">
                                <Dropdown 
                                    value={layer.depthPositionMode || 'LOCAL'} 
                                    options={['LOCAL', 'WORLD']} 
                                    onChange={(v) => onUpdate({ depthPositionMode: v as DepthPositionMode })} 
                                />
                            </PropertyRow>

                            {layer.depthOrigin === 'VECTOR' && (
                                <PropertyRow label="Origin XYZ">
                                    <div className="flex gap-1">
                                        <NumberInput value={layer.depthOriginVector?.[0] || 0} onChange={v => onUpdate({ depthOriginVector: [v, layer.depthOriginVector?.[1]||0, layer.depthOriginVector?.[2]||0] })} />
                                        <NumberInput value={layer.depthOriginVector?.[1] || 0} onChange={v => onUpdate({ depthOriginVector: [layer.depthOriginVector?.[0]||0, v, layer.depthOriginVector?.[2]||0] })} />
                                        <NumberInput value={layer.depthOriginVector?.[2] || 0} onChange={v => onUpdate({ depthOriginVector: [layer.depthOriginVector?.[0]||0, layer.depthOriginVector?.[1]||0, v] })} />
                                    </div>
                                </PropertyRow>
                            )}

                            <PropertyRow label="Near">
                                <NumberInput value={layer.depthNear || 0} onChange={v => onUpdate({ depthNear: v })} step={1} />
                            </PropertyRow>
                            <PropertyRow label="Far">
                                <NumberInput value={layer.depthFar || 5} onChange={v => onUpdate({ depthFar: v })} step={1} />
                            </PropertyRow>
                         </>
                     )}

                     {/* ... (Existing FRESNEL Logic) ... */}
                     {layer.type === 'FRESNEL' && (
                         <>
                            <div className="flex items-center bg-black/40 rounded-lg p-1 mb-2 border border-white/5">
                                <button 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${layer.fresnelMode === 'MASK' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    onClick={() => onUpdate({ fresnelMode: 'MASK' })}
                                >
                                    Mask
                                </button>
                                <button 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${layer.fresnelMode === 'COLOR' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    onClick={() => onUpdate({ fresnelMode: 'COLOR' })}
                                >
                                    Color
                                </button>
                            </div>

                            <PropertyRow label="Color">
                                <ColorPicker color={layer.color || '#ffffff'} onChange={c => onUpdate({ color: c })} />
                            </PropertyRow>
                            
                            <PropertyRow label="Bias">
                                <NumberInput value={layer.fresnelBias || 0} onChange={v => onUpdate({ fresnelBias: v })} step={0.05} />
                            </PropertyRow>
                            <PropertyRow label="Scale">
                                <NumberInput value={layer.fresnelScale || 1} onChange={v => onUpdate({ fresnelScale: v })} step={0.1} />
                            </PropertyRow>
                            <PropertyRow label="Intensity">
                                <NumberInput value={layer.fresnelIntensity || 1} onChange={v => onUpdate({ fresnelIntensity: v })} step={0.1} />
                            </PropertyRow>
                            <PropertyRow label="Factor">
                                <NumberInput value={layer.fresnelPower || 1} onChange={v => onUpdate({ fresnelPower: v })} step={0.1} />
                            </PropertyRow>
                         </>
                     )}

                     {/* --- TOON LAYER (Updated) --- */}
                     {layer.type === 'TOON' && (
                         <>
                            <PropertyRow label="Position">
                                <Dropdown 
                                    value={layer.toonPosition || 'CAMERA'} 
                                    options={['CAMERA', 'LIGHT']} 
                                    onChange={(v) => onUpdate({ toonPosition: v as ToonPosition })} 
                                />
                            </PropertyRow>

                            <div className="mb-2">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs text-zinc-500 font-medium">Gradient</span>
                                </div>
                                <GradientRamp 
                                    stops={layer.toonGradientStops || []} 
                                    onChange={(stops) => onUpdate({ toonGradientStops: stops })} 
                                    activeStopId={activeStopId}
                                    onSelectStop={setActiveStopId}
                                />
                                {activeStop && (
                                    <PropertyRow label="Stop Color">
                                        <ColorPicker color={activeStop.color} onChange={handleStopColorChange} />
                                        <span className="text-[10px] text-zinc-500 w-8 text-right">{Math.round(activeStop.offset * 100)}%</span>
                                    </PropertyRow>
                                )}
                            </div>

                            <PropertyRow label="Color">
                                <ColorPicker color={layer.color || '#ffffff'} onChange={(c) => onUpdate({ color: c })} />
                            </PropertyRow>

                            <PropertyRow label="Offset">
                                <div className="flex gap-1">
                                    <NumberInput label="X" value={layer.toonOffset?.[0] || 0} onChange={v => onUpdate({ toonOffset: [v, layer.toonOffset?.[1]||0, layer.toonOffset?.[2]||0] })} />
                                    <NumberInput label="Y" value={layer.toonOffset?.[1] || 0} onChange={v => onUpdate({ toonOffset: [layer.toonOffset?.[0]||0, v, layer.toonOffset?.[2]||0] })} />
                                    <NumberInput label="Z" value={layer.toonOffset?.[2] || 0} onChange={v => onUpdate({ toonOffset: [layer.toonOffset?.[0]||0, layer.toonOffset?.[1]||0, v] })} />
                                </div>
                            </PropertyRow>

                            <PropertyRow label="Noise">
                                <NumberInput value={layer.toonNoise || 0} onChange={v => onUpdate({ toonNoise: v })} step={0.1} />
                            </PropertyRow>

                            <PropertyRow label="Noise Scale">
                                <NumberInput value={layer.toonNoiseScale || 1} onChange={v => onUpdate({ toonNoiseScale: v })} step={0.1} />
                            </PropertyRow>
                         </>
                     )}

                     {layer.type === 'COLOR' && layer.color && (
                         <PropertyRow label="Color">
                             <ColorPicker color={layer.color} onChange={(c) => onUpdate({ color: c })} />
                         </PropertyRow>
                     )}

                     {layer.type === 'GRADIENT' && (
                         <>
                            <PropertyRow label="Start Color">
                                <ColorPicker color={layer.color || '#000000'} onChange={(c) => onUpdate({ color: c })} />
                            </PropertyRow>
                            <PropertyRow label="End Color">
                                <ColorPicker color={layer.colorB || '#ffffff'} onChange={(c) => onUpdate({ colorB: c })} />
                            </PropertyRow>
                         </>
                     )}

                     {layer.type === 'NOISE' && (
                         <>
                             <PropertyRow label="Scale">
                                 <NumberInput value={layer.scale || 1} onChange={(v) => onUpdate({ scale: v })} />
                             </PropertyRow>
                             <PropertyRow label="Intensity">
                                 <NumberInput value={layer.intensity || 0.5} onChange={(v) => onUpdate({ intensity: v })} step={0.1} />
                             </PropertyRow>
                         </>
                     )}

                     {layer.type === 'GLASS' && (
                         <>
                             <PropertyRow label="Transmission">
                                 <NumberInput value={layer.transmission || 1} onChange={(v) => onUpdate({ transmission: v })} step={0.1} max={1} />
                             </PropertyRow>
                             <PropertyRow label="Thickness">
                                 <NumberInput value={layer.thickness || 1} onChange={(v) => onUpdate({ thickness: v })} step={0.1} />
                             </PropertyRow>
                             <PropertyRow label="Roughness">
                                 <NumberInput value={layer.roughness || 0} onChange={(v) => onUpdate({ roughness: v })} step={0.05} max={1} />
                             </PropertyRow>
                             <PropertyRow label="Chrom. Aberr.">
                                 <NumberInput value={layer.chromaticAberration || 0.04} onChange={(v) => onUpdate({ chromaticAberration: v })} step={0.01} />
                             </PropertyRow>
                         </>
                     )}

                     {layer.type === 'OUTLINE' && (
                         <>
                             <PropertyRow label="Color">
                                 <ColorPicker color={layer.outlineColor || '#000000'} onChange={(c) => onUpdate({ outlineColor: c })} />
                             </PropertyRow>
                             <PropertyRow label="Width">
                                 <NumberInput value={layer.width || 0.05} onChange={(v) => onUpdate({ width: v })} step={0.01} />
                             </PropertyRow>
                         </>
                     )}
                </div>
            )}
        </div>
    );
}

export const Inspector: React.FC = () => {
  const { objects, selectedId, updateObject, addMaterialLayer, removeMaterialLayer, updateMaterialLayer, toggleLayerExpand } = useStore();
  const selectedObject = objects.find((o) => o.id === selectedId);
  const [isAddMenuOpen, setAddMenuOpen] = useState(false);

  // Material Types for Menu
  const materialTypes: { type: MaterialLayerType, label: string, icon: any }[] = [
      { type: 'LIGHTING', label: 'Lighting', icon: Lightbulb },
      { type: 'DEPTH', label: 'Depth', icon: Box },
      { type: 'FRESNEL', label: 'Fresnel', icon: Circle },
      { type: 'TOON', label: 'Toon', icon: Sun },
      { type: 'COLOR', label: 'Color', icon: Droplet },
      { type: 'IMAGE', label: 'Image', icon: ImageIcon },
      { type: 'GRADIENT', label: 'Gradient', icon: Box },
      { type: 'GLASS', label: 'Glass', icon: Ghost },
      { type: 'NOISE', label: 'Noise', icon: Activity },
      { type: 'OUTLINE', label: 'Outline', icon: Circle },
      { type: 'MATCAP', label: 'Matcap', icon: Scan },
  ];

  return (
    <div className="w-full h-full bg-[#121212]/95 backdrop-blur-xl flex flex-col overflow-y-auto custom-scrollbar select-none" onClick={() => setAddMenuOpen(false)}>
        
        {/* Header Profile */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
             <div className="flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-[#121212]">
                     D
                 </div>
                 <span className="text-xs text-zinc-500 font-medium">100%</span>
             </div>
             <div className="flex items-center gap-2">
                 <button className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-transparent rounded text-xs text-zinc-300 transition-colors font-medium">Share</button>
             </div>
        </div>

        {selectedObject ? (
            <div className="p-4">
                <div className="flex items-center gap-2 py-2 mb-4">
                    <div className="w-3 h-3 bg-blue-600 rounded-sm shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-xs font-bold text-white uppercase tracking-wide truncate">{selectedObject.name}</span>
                </div>
                
                {/* Transform */}
                <div className="mb-6 space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider pl-1">Position</label>
                        <div className="flex gap-1.5">
                            <NumberInput label="X" value={selectedObject.position[0]} onChange={v => updateObject(selectedObject.id, { position: [v, selectedObject.position[1], selectedObject.position[2]] })} />
                            <NumberInput label="Y" value={selectedObject.position[1]} onChange={v => updateObject(selectedObject.id, { position: [selectedObject.position[0], v, selectedObject.position[2]] })} />
                            <NumberInput label="Z" value={selectedObject.position[2]} onChange={v => updateObject(selectedObject.id, { position: [selectedObject.position[0], selectedObject.position[1], v] })} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider pl-1">Rotation</label>
                        <div className="flex gap-1.5">
                            <NumberInput label="X" value={(selectedObject.rotation[0] * 180 / Math.PI)} onChange={v => updateObject(selectedObject.id, { rotation: [v * Math.PI / 180, selectedObject.rotation[1], selectedObject.rotation[2]] })} />
                            <NumberInput label="Y" value={(selectedObject.rotation[1] * 180 / Math.PI)} onChange={v => updateObject(selectedObject.id, { rotation: [selectedObject.rotation[0], v * Math.PI / 180, selectedObject.rotation[2]] })} />
                            <NumberInput label="Z" value={(selectedObject.rotation[2] * 180 / Math.PI)} onChange={v => updateObject(selectedObject.id, { rotation: [selectedObject.rotation[0], selectedObject.rotation[1], v * Math.PI / 180] })} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider pl-1">Scale</label>
                        <div className="flex gap-1.5">
                            <NumberInput label="X" value={selectedObject.scale[0]} onChange={v => updateObject(selectedObject.id, { scale: [v, selectedObject.scale[1], selectedObject.scale[2]] })} />
                            <NumberInput label="Y" value={selectedObject.scale[1]} onChange={v => updateObject(selectedObject.id, { scale: [selectedObject.scale[0], v, selectedObject.scale[2]] })} />
                            <NumberInput label="Z" value={selectedObject.scale[2]} onChange={v => updateObject(selectedObject.id, { scale: [selectedObject.scale[0], selectedObject.scale[1], v] })} />
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/10 w-full mb-4"></div>
                
                {/* --- LIGHT SETTINGS --- */}
                {selectedObject.type === ObjectType.LIGHT && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3 px-1 text-yellow-500">
                             <Sun size={12} />
                             <span className="text-[11px] font-bold uppercase tracking-wider">Light Settings</span>
                        </div>
                        <div className="space-y-2 px-1">
                            <PropertyRow label="Intensity">
                                <NumberInput value={selectedObject.intensity || 1} onChange={v => updateObject(selectedObject.id, { intensity: v })} step={0.1} />
                            </PropertyRow>
                            <PropertyRow label="Color">
                                <ColorPicker color={selectedObject.color || '#ffffff'} onChange={c => updateObject(selectedObject.id, { color: c })} />
                            </PropertyRow>
                            <PropertyRow label="Cast Shadow">
                                <Toggle checked={!!selectedObject.castShadow} onChange={() => updateObject(selectedObject.id, { castShadow: !selectedObject.castShadow })} />
                            </PropertyRow>
                            
                            {selectedObject.lightType !== LightType.DIRECTIONAL && selectedObject.lightType !== LightType.AMBIENT && (
                                <>
                                    <PropertyRow label="Distance">
                                        <NumberInput value={selectedObject.distance || 0} onChange={v => updateObject(selectedObject.id, { distance: v })} step={1} />
                                    </PropertyRow>
                                    <PropertyRow label="Decay">
                                        <NumberInput value={selectedObject.decay || 1} onChange={v => updateObject(selectedObject.id, { decay: v })} step={0.1} />
                                    </PropertyRow>
                                </>
                            )}
                            
                            {selectedObject.lightType === LightType.SPOT && (
                                <>
                                    <PropertyRow label="Angle">
                                        <NumberInput value={selectedObject.angle || 0.5} onChange={v => updateObject(selectedObject.id, { angle: v })} step={0.05} max={1.5} />
                                    </PropertyRow>
                                    <PropertyRow label="Penumbra">
                                        <NumberInput value={selectedObject.penumbra || 0.1} onChange={v => updateObject(selectedObject.id, { penumbra: v })} step={0.05} max={1} />
                                    </PropertyRow>
                                </>
                            )}
                        </div>
                         <div className="h-px bg-white/10 w-full my-4"></div>
                    </div>
                )}

                {/* --- CAMERA SETTINGS --- */}
                {selectedObject.type === ObjectType.CAMERA && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3 px-1 text-blue-500">
                             <Camera size={12} />
                             <span className="text-[11px] font-bold uppercase tracking-wider">Camera Settings</span>
                        </div>
                        <div className="space-y-2 px-1">
                            <PropertyRow label="FOV">
                                <NumberInput value={selectedObject.fov || 75} onChange={v => updateObject(selectedObject.id, { fov: v })} step={1} max={180} />
                            </PropertyRow>
                            <PropertyRow label="Near">
                                <NumberInput value={selectedObject.near || 0.1} onChange={v => updateObject(selectedObject.id, { near: v })} step={0.1} />
                            </PropertyRow>
                            <PropertyRow label="Far">
                                <NumberInput value={selectedObject.far || 1000} onChange={v => updateObject(selectedObject.id, { far: v })} step={10} />
                            </PropertyRow>
                        </div>
                         <div className="h-px bg-white/10 w-full my-4"></div>
                    </div>
                )}
                
                {/* --- MODEL ANIMATION SETTINGS --- */}
                {selectedObject.type === ObjectType.MODEL && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3 px-1 text-purple-400">
                             <Film size={12} />
                             <span className="text-[11px] font-bold uppercase tracking-wider">Animation Settings</span>
                        </div>
                        <div className="space-y-2 px-1">
                            {selectedObject.availableAnimations && selectedObject.availableAnimations.length > 0 ? (
                                <PropertyRow label="Active Clip">
                                    <Dropdown 
                                        value={selectedObject.activeAnimation || 'None'}
                                        options={['None', ...selectedObject.availableAnimations]} 
                                        onChange={(v) => updateObject(selectedObject.id, { activeAnimation: v === 'None' ? undefined : v })} 
                                    />
                                </PropertyRow>
                            ) : (
                                <div className="text-xs text-zinc-500 italic px-1">No animations found in model</div>
                            )}
                            
                             <PropertyRow label="Show Skeleton">
                                <Toggle checked={!!selectedObject.showSkeleton} onChange={() => updateObject(selectedObject.id, { showSkeleton: !selectedObject.showSkeleton })} />
                            </PropertyRow>
                        </div>
                         <div className="h-px bg-white/10 w-full my-4"></div>
                    </div>
                )}


                {/* Material System (Only for Mesh) */}
                {selectedObject.type === ObjectType.MESH && (
                    <div className="mb-4 relative">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <div className="bg-purple-500/20 p-1 rounded text-purple-400"><Layers size={12} /></div>
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Material</span>
                            </div>
                            
                            <div className="relative">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setAddMenuOpen(!isAddMenuOpen); }}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <Plus size={12} />
                                </button>
                                
                                {isAddMenuOpen && (
                                    <div className="absolute right-0 top-6 w-40 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-white/50 border-b border-white/5 mb-1">
                                            <Sparkles size={10} /> AI Texture
                                        </div>
                                        {materialTypes.map(item => (
                                            <button 
                                                key={item.type}
                                                onClick={() => { addMaterialLayer(selectedObject.id, item.type); setAddMenuOpen(false); }}
                                                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-blue-600 hover:text-white text-zinc-400 text-xs transition-colors text-left"
                                            >
                                                <item.icon size={14} /> {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-0.5">
                            {selectedObject.materialLayers && selectedObject.materialLayers.length > 0 ? (
                                selectedObject.materialLayers.map(layer => (
                                    <MaterialLayerRow 
                                        key={layer.id} 
                                        layer={layer} 
                                        onUpdate={(updates) => updateMaterialLayer(selectedObject.id, layer.id, updates)}
                                        onDelete={() => removeMaterialLayer(selectedObject.id, layer.id)}
                                        onExpand={() => toggleLayerExpand(selectedObject.id, layer.id)}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-4 text-xs text-zinc-600 italic border border-dashed border-white/10 rounded-lg">
                                    No material layers
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="p-4 text-center">
                 <SectionHeader title="Scene Settings" />
                 <PropertyRow label="BG Color">
                     <ColorPicker color="#2D2E32" onChange={() => {}} />
                 </PropertyRow>
                 <div className="mt-4 text-xs text-zinc-500">Select an object to edit settings</div>
            </div>
        )}
    </div>
  );
};
