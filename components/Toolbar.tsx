
import React, { useRef, useState } from 'react';
import { useStore } from '../store';
import { ObjectType, ShapeType, LightType } from '../types';
import { Box, Circle, Triangle, Lightbulb, Camera, Upload, Plus, Sparkles, Move, Rotate3D, Scaling, Layers, Monitor, Download, Hand, Wrench, Video, X, Check, Aperture } from 'lucide-react';
import { GeminiAssistant } from './GeminiAssistant';

export const Toolbar: React.FC = () => {
  const { addObject, setEditorMode, editorMode, previewCameraId, setPreviewCameraId, setIsExporting, isExporting, objects, useGizmo, setUseGizmo, setExportModalOpen, triggerAddCamera } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showAI, setShowAI] = useState(false);
  
  const hasCamera = objects.some(o => o.type === ObjectType.CAMERA);
  const cameras = objects.filter(o => o.type === ObjectType.CAMERA);

  const navItemClass = "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/10 text-white/70 hover:text-white cursor-pointer relative";
  const activeNavItemClass = "bg-accent/20 text-accent shadow-[0_0_15px_rgba(0,242,254,0.3)]";

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
      });
      setShowAddMenu(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cycleGizmo = () => {
      if (editorMode === 'translate') setEditorMode('rotate');
      else if (editorMode === 'rotate') setEditorMode('scale');
      else setEditorMode('translate');
  };
  
  const handleExportClick = () => {
      if (!hasCamera) {
          alert("Please add a camera to the scene to export video.");
          return;
      }
      setExportModalOpen(true);
  };
  
  const handleAddCamera = () => {
      triggerAddCamera();
      setShowAddMenu(false);
  }

  const GizmoIcon = editorMode === 'translate' ? Move : editorMode === 'rotate' ? Rotate3D : Scaling;

  return (
    <div className="flex flex-col gap-6 bg-glass-900/60 backdrop-blur-2xl border border-white/10 p-3 rounded-2xl shadow-2xl relative">
      
      {/* Branding / Logo */}
      <div className="flex flex-col items-center gap-2 border-b border-white/10 pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center shadow-lg shadow-accent/20">
            <Layers size={20} className="text-white" />
        </div>
      </div>

      {/* Tools Section */}
      <div className="flex flex-col gap-3 items-center">
          {/* Add Object */}
          <div className="relative">
              <button 
                  className={`${navItemClass} ${showAddMenu ? activeNavItemClass : ''}`}
                  onClick={() => { setShowAddMenu(!showAddMenu); setShowAI(false); setShowCameraMenu(false); }}
                  title="Add Object"
                  disabled={isExporting}
              >
                  <Plus size={24} />
              </button>

              {/* Add Menu Popover */}
              {showAddMenu && !isExporting && (
                  <div className="absolute left-14 top-0 bg-glass-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 w-48 flex flex-col gap-2 z-50 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-200">
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 px-1">Primitives</div>
                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => addObject({ type: ObjectType.MESH, shape: ShapeType.CUBE, name: 'Cube' })}>
                          <Box size={16} /> Cube
                      </button>
                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => addObject({ type: ObjectType.MESH, shape: ShapeType.SPHERE, name: 'Sphere' })}>
                          <Circle size={16} /> Sphere
                      </button>
                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => addObject({ type: ObjectType.MESH, shape: ShapeType.TORUS, name: 'Torus' })}>
                          <Triangle size={16} /> Torus
                      </button>
                      
                      <div className="h-px bg-white/10 my-1"></div>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 px-1">Scene</div>

                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => addObject({ type: ObjectType.LIGHT, lightType: LightType.POINT, name: 'Point Light', position: [0, 5, 0] })}>
                          <Lightbulb size={16} /> Point Light
                      </button>
                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => addObject({ type: ObjectType.LIGHT, lightType: LightType.SPOT, name: 'Spot Light', position: [0, 5, 5], angle: 0.5 })}>
                          <Aperture size={16} /> Spot Light
                      </button>
                      
                      <div className="h-px bg-white/10 my-1"></div>
                      
                      <button className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={16} /> Import GLB
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".glb,.gltf" className="hidden" />
                  </div>
              )}
          </div>

          {/* Camera Controls */}
          <div className="relative">
              <button 
                  className={`${navItemClass} ${previewCameraId ? 'text-red-400 hover:text-red-300' : ''} ${showCameraMenu ? activeNavItemClass : ''}`}
                  onClick={() => { setShowCameraMenu(!showCameraMenu); setShowAddMenu(false); setShowAI(false); }}
                  title="Camera Controls"
                  disabled={isExporting}
              >
                  <Camera size={20} className={previewCameraId ? "animate-pulse" : ""} />
                  {previewCameraId && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
              </button>

              {showCameraMenu && !isExporting && (
                 <div className="absolute left-14 top-0 bg-glass-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 w-56 flex flex-col gap-2 z-50 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-200">
                     <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1 px-1">Cameras</div>
                     
                     {cameras.length === 0 ? (
                         <div className="text-xs text-white/30 italic px-2 py-1">No cameras in scene</div>
                     ) : (
                         cameras.map(cam => (
                             <button 
                                key={cam.id}
                                onClick={() => { setPreviewCameraId(cam.id); setShowCameraMenu(false); }}
                                className={`flex items-center justify-between p-2 rounded text-sm transition-colors w-full text-left ${
                                    previewCameraId === cam.id 
                                    ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/30' 
                                    : 'hover:bg-white/10 text-white/70 hover:text-white border border-transparent'
                                }`}
                             >
                                 <span className="truncate flex-1 mr-2">{cam.name}</span>
                                 {previewCameraId === cam.id && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />}
                             </button>
                         ))
                     )}

                     <div className="h-px bg-white/10 my-1"></div>
                     
                     <button 
                        className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors text-left"
                        onClick={() => { triggerAddCamera(); setShowCameraMenu(false); }}
                     >
                         <Plus size={14} /> New Camera
                     </button>

                     {previewCameraId && (
                         <button 
                            className="flex items-center gap-3 p-2 rounded hover:bg-white/10 text-sm transition-colors text-left text-white/50 hover:text-white hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => { setPreviewCameraId(null); setShowCameraMenu(false); }}
                         >
                             <X size={14} /> Exit View
                         </button>
                     )}
                 </div>
              )}
          </div>

          {/* Mode Toggle: Hand (Drag) vs Gizmo */}
          <button 
              className={`${navItemClass} ${!useGizmo ? activeNavItemClass : ''}`}
              onClick={() => { setUseGizmo(!useGizmo); setShowCameraMenu(false); setShowAddMenu(false); setShowAI(false); }}
              title={useGizmo ? "Switch to Direct Drag Mode" : "Switch to Gizmo Mode"}
              disabled={isExporting}
          >
              {useGizmo ? <Wrench size={20} /> : <Hand size={20} />}
          </button>

          {/* Gizmo Tool Selector (Only active if useGizmo is true) */}
          {useGizmo && (
              <button 
                  className={navItemClass}
                  onClick={cycleGizmo}
                  title={`Current Gizmo: ${editorMode}`}
                  disabled={isExporting}
              >
                  <GizmoIcon size={20} />
                  <div className="absolute -bottom-1 text-[8px] font-bold uppercase opacity-50">{editorMode.slice(0,1)}</div>
              </button>
          )}

          {/* AI Assistant */}
          <div className="relative">
              <button 
                    className={`${navItemClass} ${showAI ? activeNavItemClass : ''}`}
                    onClick={() => { setShowAI(!showAI); setShowAddMenu(false); setShowCameraMenu(false); }}
                    title="AI Assistant"
                    disabled={isExporting}
                >
                    <Sparkles size={20} />
              </button>
              
              {/* AI Panel Popover */}
              {showAI && !isExporting && (
                   <div className="absolute left-14 top-0 w-80 z-50 animate-in fade-in slide-in-from-left-4 duration-200">
                       <GeminiAssistant />
                   </div>
              )}
          </div>
      </div>

      {/* Spacer */}
      <div className="h-px bg-white/10 w-full"></div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-3 items-center pb-1">
          <button 
            className={`${navItemClass} ${isExporting ? 'bg-red-500/20 text-red-500 animate-pulse' : ''}`} 
            title={isExporting ? "Rendering..." : "Export Video"}
            onClick={handleExportClick}
            disabled={isExporting}
          >
              {isExporting ? <Video size={20} className="animate-spin" /> : <Download size={20} />}
          </button>
      </div>

    </div>
  );
};
