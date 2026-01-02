
import React, { useState } from 'react';
import { useStore } from '../store';
import { ObjectType, ShapeType } from '../types';
import { 
    Plus, Sparkles, Box, Type, PenTool, MessageSquare, 
    MousePointer2, Timer, Play, ChevronDown, Circle, Triangle, Hexagon, Star, Cylinder, Cone, Pyramid, Hand, Wrench
} from 'lucide-react';

export const TopBar: React.FC = () => {
    const { addObject, isPlaying, setPlaying, useGizmo, setUseGizmo, isTimelineOpen, setTimelineOpen } = useStore();
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const toggleDropdown = (name: string) => {
        setActiveDropdown(activeDropdown === name ? null : name);
    };

    const handleAddObject = (type: ShapeType, name: string) => {
        addObject({ type: ObjectType.MESH, shape: type, name });
        setActiveDropdown(null);
    };

    // Helper for dropdown items
    const DropdownItem = ({ icon: Icon, label, shortcut, type }: any) => (
        <button 
            onClick={() => handleAddObject(type, label)}
            className="flex items-center justify-between w-full p-2 hover:bg-white/10 rounded group"
        >
            <div className="flex items-center gap-3">
                <Icon size={16} className="text-zinc-400 group-hover:text-white" />
                <span className="text-sm text-zinc-300 group-hover:text-white">{label}</span>
            </div>
            {shortcut && <span className="text-xs text-zinc-600">{shortcut}</span>}
        </button>
    );

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center bg-[#121212] border border-zinc-800 rounded-full px-2 py-1.5 shadow-2xl relative">
                
                {/* Plus Button */}
                <button className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-white">
                    <Plus size={20} />
                </button>

                <div className="w-px h-6 bg-zinc-800 mx-2"></div>

                {/* AI / Sparkles */}
                <button className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <Sparkles size={18} />
                </button>

                {/* 2D Shapes Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => toggleDropdown('2d')}
                        className={`flex items-center gap-1 px-2 h-9 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors ${activeDropdown === '2d' ? 'bg-white/10 text-white' : ''}`}
                    >
                        <Circle size={18} className="stroke-[1.5]" />
                        <ChevronDown size={10} strokeWidth={3} />
                    </button>
                    
                    {activeDropdown === '2d' && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#121212] border border-zinc-800 rounded-xl p-2 shadow-xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                             <DropdownItem icon={Box} label="Rectangle" shortcut="R" type={ShapeType.RECTANGLE} />
                             <DropdownItem icon={Circle} label="Ellipse" shortcut="O" type={ShapeType.ELLIPSE} />
                             <DropdownItem icon={Triangle} label="Triangle" shortcut="K" type={ShapeType.TRIANGLE} />
                             <DropdownItem icon={Hexagon} label="Polygon" shortcut="P" type={ShapeType.POLYGON} />
                             <DropdownItem icon={Star} label="Star" type={ShapeType.STAR} />
                        </div>
                    )}
                </div>

                {/* 3D Shapes Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => toggleDropdown('3d')}
                        className={`flex items-center gap-1 px-2 h-9 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors ${activeDropdown === '3d' ? 'bg-white/10 text-white' : ''}`}
                    >
                        <Box size={18} className="stroke-[1.5]" />
                        <ChevronDown size={10} strokeWidth={3} />
                    </button>

                    {activeDropdown === '3d' && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-[#121212] border border-zinc-800 rounded-xl p-2 shadow-xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                             <DropdownItem icon={Box} label="Cube" type={ShapeType.CUBE} />
                             <DropdownItem icon={Circle} label="Sphere" type={ShapeType.SPHERE} />
                             <DropdownItem icon={Cylinder} label="Cylinder" type={ShapeType.CYLINDER} />
                             <DropdownItem icon={Circle} label="Torus" type={ShapeType.TORUS} />
                             <DropdownItem icon={Cone} label="Cone" type={ShapeType.CONE} />
                             <DropdownItem icon={Pyramid} label="Pyramid" type={ShapeType.PYRAMID} />
                             <DropdownItem icon={Hexagon} label="Icosahedron" type={ShapeType.ICOSAHEDRON} />
                        </div>
                    )}
                </div>

                {/* Text */}
                <button className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <Type size={18} />
                </button>

                {/* Vector / Pen Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => toggleDropdown('pen')}
                        className={`flex items-center gap-1 px-2 h-9 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors ${activeDropdown === 'pen' ? 'bg-white/10 text-white' : ''}`}
                    >
                        <PenTool size={18} className="stroke-[1.5]" />
                        <ChevronDown size={10} strokeWidth={3} />
                    </button>
                     {activeDropdown === 'pen' && (
                        <div className="absolute top-full left-0 mt-2 w-40 bg-[#121212] border border-zinc-800 rounded-xl p-2 shadow-xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                             <button className="flex items-center gap-3 p-2 hover:bg-white/10 rounded w-full text-left">
                                 <PenTool size={16} className="text-zinc-400" /> <span className="text-sm text-zinc-300">Pen</span>
                             </button>
                             <button className="flex items-center gap-3 p-2 hover:bg-white/10 rounded w-full text-left">
                                 <div className="w-4 h-4 border border-zinc-400 rounded-full" /> <span className="text-sm text-zinc-300">Path</span>
                             </button>
                        </div>
                    )}
                </div>

                {/* Comment */}
                <button className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                    <MessageSquare size={18} />
                </button>

                <div className="w-px h-6 bg-zinc-800 mx-2"></div>

                {/* Mode Toggle: Design (Cursor) vs Animation (Timer) */}
                <div className="bg-[#1c1c1c] rounded-lg p-0.5 flex items-center">
                     <button 
                        onClick={() => setTimelineOpen(false)}
                        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${!isTimelineOpen ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        title="Design Mode"
                    >
                        <MousePointer2 size={16} />
                     </button>
                     <button 
                        onClick={() => setTimelineOpen(true)}
                        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${isTimelineOpen ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        title="Animation Mode"
                    >
                        <Timer size={16} />
                     </button>
                </div>

                <div className="w-px h-6 bg-zinc-800 mx-2"></div>

                <button 
                    onClick={() => setPlaying(!isPlaying)}
                    className={`w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 ${isPlaying ? 'text-blue-500' : ''}`}
                >
                    <Play size={18} fill={isPlaying ? "currentColor" : "none"} />
                </button>
            </div>
            
            {/* Backdrop for closing dropdowns */}
            {activeDropdown && (
                <div className="fixed inset-0 z-[-1]" onClick={() => setActiveDropdown(null)}></div>
            )}
        </div>
    );
};
