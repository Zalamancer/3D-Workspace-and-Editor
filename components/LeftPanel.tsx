
import React, { useState, useRef } from 'react';
import { useStore } from '../store';
import { Search, ChevronDown, Box, Sun, Camera, FileBox, LayoutTemplate, Upload, Plus, Folder, Bone, Film, Download, Trash2 } from 'lucide-react';
import { ObjectType, LightType, Asset } from '../types';

export const LeftPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'OBJECTS' | 'ASSETS'>('OBJECTS');
    const { objects, selectedId, selectedBone, selectObject, selectBone, addObject, assets, addAsset, removeAsset, updateObject } = useStore();
    const [sceneExpanded, setSceneExpanded] = useState(true);
    const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedObjects);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedObjects(newSet);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            addObject({
                type: ObjectType.MODEL,
                name: file.name.split('.')[0],
                modelUrl: url,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                visible: true,
                showSkeleton: true, // Auto-show skeleton for easier debugging of characters
            });
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const extractAnimation = (modelId: string, animName: string, duration?: number) => {
        const model = objects.find(o => o.id === modelId);
        if (!model) return;
        
        // Check if already exists
        const existing = assets.find(a => a.type === 'ANIMATION' && a.sourceModelId === modelId && a.animationName === animName);
        if(existing) return;

        const newAsset: Asset = {
            id: crypto.randomUUID(),
            name: animName,
            type: 'ANIMATION',
            animationName: animName,
            sourceModelId: modelId,
            sourceModelUrl: model.modelUrl, // Store URL to fetch clip later
            duration: duration || 0
        };
        addAsset(newAsset);
    };

    const applyAsset = (asset: Asset) => {
        if (!selectedId) return;
        const selectedObj = objects.find(o => o.id === selectedId);
        if (!selectedObj || selectedObj.type !== ObjectType.MODEL) return;

        if (asset.type === 'ANIMATION') {
             if (asset.animationName) {
                 updateObject(selectedId, { activeAnimation: asset.animationName });
             }
        }
    };

    const getIcon = (type: ObjectType, lightType?: LightType) => {
        if (type === ObjectType.MESH) return <Box size={13} className="text-zinc-400" />;
        if (type === ObjectType.LIGHT) return <Sun size={13} className="text-yellow-500" />;
        if (type === ObjectType.CAMERA) return <Camera size={13} className="text-green-500" />;
        if (type === ObjectType.MODEL) return <FileBox size={13} className="text-blue-400" />;
        return <Box size={13} />;
    };

    const selectedModel = objects.find(o => o.id === selectedId && o.type === ObjectType.MODEL);

    return (
        <div className="w-full h-full bg-[#121212]/95 backdrop-blur-xl flex flex-col text-xs font-medium">
            {/* Header Tabs */}
            <div className="flex items-center px-4 pt-4 gap-6 border-b border-white/10">
                <button 
                    onClick={() => setActiveTab('OBJECTS')}
                    className={`pb-3 transition-colors relative ${activeTab === 'OBJECTS' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Objects
                    {activeTab === 'OBJECTS' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('ASSETS')}
                    className={`pb-3 transition-colors relative ${activeTab === 'ASSETS' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Assets
                    {activeTab === 'ASSETS' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"></div>}
                </button>
            </div>

            {/* Search */}
            <div className="px-3 py-3">
                <div className="bg-white/5 border border-white/10 rounded-lg flex items-center px-2 py-1.5 gap-2 group focus-within:border-zinc-600 transition-colors">
                    <Search size={13} className="text-zinc-500 group-focus-within:text-white" />
                    <input 
                        type="text" 
                        placeholder="Search" 
                        className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-600 w-full h-full" 
                    />
                </div>
            </div>

            {/* Tree View / Assets View */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                {activeTab === 'OBJECTS' && (
                    <div className="mb-1">
                        <div 
                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5 cursor-pointer text-zinc-400 hover:text-white transition-colors"
                            onClick={() => setSceneExpanded(!sceneExpanded)}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-500">Scenes</span>
                                <ChevronDown size={10} className={`transform transition-transform ${sceneExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            </div>
                            <Plus size={12} className="opacity-0 hover:opacity-100 text-zinc-400" />
                        </div>

                        {sceneExpanded && (
                            <div className="mt-0.5">
                                <div className="flex items-center gap-2 py-1.5 px-2 pl-4 text-white text-xs mb-1 bg-white/5 rounded">
                                    <span className="opacity-50">✓</span>
                                    <span>Scene 1</span>
                                </div>
                                
                                <div className="flex flex-col gap-px pl-2">
                                    <div className="flex items-center gap-2 py-1.5 px-2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                                        <Folder size={12} fill="currentColor" className="text-zinc-600" /> 
                                        <span>Default Camera</span>
                                    </div>
                                    
                                    <div className="h-px bg-white/10 mx-2 my-1 opacity-50"></div>

                                    {objects.map(obj => {
                                        const hasBones = obj.bones && obj.bones.length > 0;
                                        const isExpanded = expandedObjects.has(obj.id);
                                        const isObjSelected = selectedId === obj.id && !selectedBone;

                                        return (
                                            <div key={obj.id}>
                                                <div 
                                                    onClick={() => selectObject(obj.id)}
                                                    className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors border border-transparent ${
                                                        isObjSelected
                                                        ? 'bg-blue-600 text-white' 
                                                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                                    }`}
                                                >
                                                    {/* Expand Arrow for Hierarchy */}
                                                    {hasBones ? (
                                                        <div onClick={(e) => toggleExpand(obj.id, e)} className="p-0.5 hover:bg-white/20 rounded cursor-pointer">
                                                            <ChevronDown size={10} className={`transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                        </div>
                                                    ) : <div className="w-3" />}
                                                    
                                                    <div className={isObjSelected ? 'text-white' : 'text-zinc-500'}>
                                                        {getIcon(obj.type, obj.lightType)}
                                                    </div>
                                                    <span className="truncate">{obj.name}</span>
                                                </div>

                                                {/* Render Bones if expanded */}
                                                {hasBones && isExpanded && (
                                                    <div className="pl-4 border-l border-white/5 ml-3 my-1">
                                                        {obj.bones?.map((bone, idx) => {
                                                            const isBoneSelected = selectedId === obj.id && selectedBone === bone.name;
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    onClick={(e) => { e.stopPropagation(); selectBone(obj.id, bone.name); }}
                                                                    className={`flex items-center gap-2 py-1 px-2 text-[10px] cursor-pointer rounded transition-colors ${
                                                                        isBoneSelected 
                                                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                                                        : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                                                    }`}
                                                                    style={{ paddingLeft: `${Math.min(bone.depth * 8, 40)}px` }}
                                                                >
                                                                    <Bone size={10} className={isBoneSelected ? 'text-blue-400' : ''} />
                                                                    <span className="truncate">{bone.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ASSETS' && (
                    <div className="space-y-4">
                         {/* Available Animations for Selected Model */}
                         {selectedModel && selectedModel.availableAnimations && selectedModel.availableAnimations.length > 0 && (
                             <div>
                                 <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                     From Selection ({selectedModel.name})
                                 </div>
                                 <div className="space-y-1">
                                     {selectedModel.availableAnimations.map((anim, idx) => {
                                         const duration = selectedModel.animationDurations?.[anim];
                                         const isStored = assets.some(a => a.type === 'ANIMATION' && a.sourceModelId === selectedModel.id && a.animationName === anim);
                                         
                                         return (
                                             <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded border border-transparent hover:border-white/10 group">
                                                 <div className="flex items-center gap-2 overflow-hidden">
                                                     <Film size={12} className="text-zinc-500" />
                                                     <div className="flex flex-col min-w-0">
                                                         <span className="text-zinc-300 truncate text-xs">{anim}</span>
                                                         {duration && <span className="text-[9px] text-zinc-600">{duration.toFixed(2)}s</span>}
                                                     </div>
                                                 </div>
                                                 <button 
                                                    onClick={() => extractAnimation(selectedModel.id, anim, duration)}
                                                    disabled={isStored}
                                                    className={`p-1.5 rounded transition-colors ${isStored ? 'text-green-500 opacity-50 cursor-default' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                                                    title="Extract to Project Assets"
                                                 >
                                                     {isStored ? <span className="text-[10px]">Saved</span> : <Download size={12} />}
                                                 </button>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         )}

                         {/* Global Project Assets */}
                         <div>
                             <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 mt-2">
                                 Project Library
                             </div>
                             {assets.length === 0 ? (
                                 <div className="text-center py-4 text-xs text-zinc-600 italic">No assets extracted</div>
                             ) : (
                                 <div className="grid grid-cols-2 gap-2 px-1">
                                     {assets.map(asset => (
                                         <div 
                                            key={asset.id} 
                                            onClick={() => applyAsset(asset)}
                                            className="bg-white/5 rounded-lg p-3 border border-white/5 hover:border-blue-500/50 cursor-pointer group relative hover:bg-white/10 transition-all"
                                         >
                                             <div className="flex items-center justify-between mb-2">
                                                 {asset.type === 'ANIMATION' && <Film size={14} className="text-purple-400" />}
                                                 {asset.type === 'MODEL' && <FileBox size={14} className="text-blue-400" />}
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-zinc-500 transition-opacity"
                                                 >
                                                     <Trash2 size={12} />
                                                 </button>
                                             </div>
                                             <div className="text-xs text-zinc-300 font-medium truncate mb-0.5">{asset.name}</div>
                                             {asset.duration && <div className="text-[9px] text-zinc-600">{asset.duration.toFixed(2)}s</div>}
                                             
                                             <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-active:opacity-100 rounded-lg pointer-events-none transition-opacity" />
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                    </div>
                )}
            </div>

            {/* Bottom Menu */}
            <div className="mt-auto border-t border-white/10 p-2 space-y-0.5">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-colors">
                    <LayoutTemplate size={14} /> Templates
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                >
                    <Upload size={14} /> Import
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".glb,.gltf" 
                    onChange={handleFileUpload}
                />
            </div>
        </div>
    );
};
