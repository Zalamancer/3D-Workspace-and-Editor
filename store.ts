
import { create } from 'zustand';
import { AppState, ObjectType, ShapeType, LightType, InterpolationType, Keyframe, MaterialLayer, MaterialLayerType } from './types';

// Utility for ID generation using native browser API
const generateId = () => self.crypto.randomUUID();

const createDefaultMaterial = (color = '#94a3b8'): MaterialLayer[] => [
    {
        id: generateId(),
        type: 'COLOR',
        name: 'Color',
        visible: true,
        opacity: 100,
        color: color,
        expanded: true,
    },
    {
        id: generateId(),
        type: 'LIGHTING',
        name: 'Lighting',
        visible: true,
        opacity: 100,
        lightingType: 'PHYSICAL',
        roughness: 0.5,
        metalness: 0.1,
        expanded: true
    }
];

const createLayer = (type: MaterialLayerType): MaterialLayer => {
    const base = {
        id: generateId(),
        type,
        visible: true,
        opacity: 100,
        expanded: true,
    };
    
    switch(type) {
        case 'COLOR': return { ...base, name: 'Color', color: '#3b82f6' };
        case 'GRADIENT': return { ...base, name: 'Gradient', color: '#3b82f6', colorB: '#8b5cf6' };
        case 'NOISE': return { ...base, name: 'Noise', scale: 1, intensity: 0.5 };
        case 'GLASS': return { ...base, name: 'Glass', transmission: 1, thickness: 1.5, roughness: 0.1, ior: 1.5, chromaticAberration: 0.04 };
        case 'OUTLINE': return { ...base, name: 'Outline', width: 0.05, outlineColor: '#000000' };
        case 'TOON': return { 
            ...base, 
            name: 'Toon', 
            color: '#ffffff',
            toonPosition: 'CAMERA',
            toonGradientStops: [
                { id: generateId(), color: '#000000', offset: 0 },
                { id: generateId(), color: '#ffffff', offset: 1 }
            ],
            toonOffset: [0, 0, 0],
            toonNoise: 0,
            toonNoiseScale: 1
        };
        case 'MATCAP': return { ...base, name: 'Matcap' };
        case 'LIGHTING': return { 
            ...base, 
            name: 'Lighting', 
            lightingType: 'PHYSICAL', 
            roughness: 0.5, 
            metalness: 0.1, 
            shininess: 30, 
            specularColor: '#111111',
            clearcoat: 0,
            clearcoatRoughness: 0
        };
        case 'DEPTH': return {
            ...base,
            name: 'Depth',
            depthOrigin: 'VECTOR',
            depthType: 'RADIAL',
            depthPositionMode: 'LOCAL',
            depthNear: 0,
            depthFar: 5,
            depthOriginVector: [0, 0, 0],
            gradientStops: [
                { id: generateId(), color: '#ffffff', offset: 0 },
                { id: generateId(), color: '#000000', offset: 1 }
            ]
        };
        case 'FRESNEL': return {
            ...base,
            name: 'Fresnel',
            color: '#ffffff',
            fresnelBias: 0.1,
            fresnelScale: 1,
            fresnelPower: 2, // Used as Factor in shader generally
            fresnelIntensity: 2,
            fresnelFactor: 1, // Another multiplier often used in UI
            fresnelMode: 'COLOR'
        };
        case 'IMAGE': return { 
            ...base, 
            name: 'Image', 
            imageMode: 'COLOR',
            projection: 'UV',
            wrapping: 'REPEAT',
            sharpness: 'SMOOTH',
            crop: false,
            scaleX: 1, scaleY: 1,
            offsetX: 0, offsetY: 0,
            rotation: 0
        };
        default: return { ...base, name: 'Layer' };
    }
}

export const useStore = create<AppState>((set, get) => ({
  objects: [
    {
      id: '1',
      name: 'Main Camera',
      type: ObjectType.CAMERA,
      position: [0, 2, 8],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      fov: 45,
      materialLayers: [],
    },
    {
      id: '2',
      name: 'Directional Light',
      type: ObjectType.LIGHT,
      lightType: LightType.DIRECTIONAL,
      position: [5, 5, 5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      intensity: 1.5,
      color: '#ffffff',
      castShadow: true,
      materialLayers: [],
    },
    {
      id: '4',
      name: 'Glass Cube',
      type: ObjectType.MESH,
      shape: ShapeType.CUBE,
      position: [0, 0, 0],
      rotation: [0, 0.5, 0],
      scale: [1.5, 1.5, 1.5],
      visible: true,
      castShadow: true,
      materialLayers: [
          { ...createLayer('GLASS'), visible: true },
          { ...createLayer('COLOR'), color: '#a5f3fc', opacity: 50 },
          { ...createLayer('OUTLINE'), width: 0.02, outlineColor: '#ffffff', opacity: 40 }
      ],
    },
  ],
  assets: [], 
  selectedId: null,
  selectedBone: null,
  editorMode: 'translate',
  useGizmo: true, 
  previewCameraId: null,
  cameraType: 'PERSPECTIVE',
  isDragging: false,
  isExporting: false,
  showAdvancedBones: false,
  isExportModalOpen: false,
  isTimelineOpen: true,
  
  fog: {
      enabled: false,
      color: '#09090b',
      near: 10,
      far: 50
  },
  
  currentTime: 0,
  isPlaying: false,
  autoKey: true,
  maxDuration: 10,
  tracks: [],
  selectedKeyframeIds: [],
  
  captureKeyframesTrigger: 0,
  addCameraTrigger: 0,

  addObject: (obj) =>
    set((state) => ({
      objects: [
        ...state.objects,
        {
          id: generateId(),
          name: 'New Object',
          type: ObjectType.MESH,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
          showSkeleton: true,
          bones: [],
          segments: 32,
          radius: 0,
          castShadow: true,
          materialLayers: obj.type === ObjectType.MESH ? createDefaultMaterial(obj.color) : [],
          ...obj,
        } as any,
      ],
    })),

  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      selectedBone: state.selectedId === id ? null : state.selectedBone,
      tracks: state.tracks.filter(t => t.targetId !== id),
    })),

  selectObject: (id) => set({ selectedId: id, selectedBone: null }),
  
  selectBone: (objectId, name) => set({ selectedId: objectId, selectedBone: name }),

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    })),

  addMaterialLayer: (objectId, type) => 
    set((state) => ({
        objects: state.objects.map(obj => {
            if (obj.id !== objectId) return obj;
            return {
                ...obj,
                materialLayers: [createLayer(type), ...obj.materialLayers] // Add to top
            };
        })
    })),

  removeMaterialLayer: (objectId, layerId) =>
    set((state) => ({
        objects: state.objects.map(obj => {
            if (obj.id !== objectId) return obj;
            return {
                ...obj,
                materialLayers: obj.materialLayers.filter(l => l.id !== layerId)
            };
        })
    })),

  updateMaterialLayer: (objectId, layerId, updates) =>
    set((state) => ({
        objects: state.objects.map(obj => {
            if (obj.id !== objectId) return obj;
            return {
                ...obj,
                materialLayers: obj.materialLayers.map(l => l.id === layerId ? { ...l, ...updates } : l)
            };
        })
    })),

  toggleLayerExpand: (objectId, layerId) =>
      set((state) => ({
          objects: state.objects.map(obj => {
              if (obj.id !== objectId) return obj;
              return {
                  ...obj,
                  materialLayers: obj.materialLayers.map(l => l.id === layerId ? { ...l, expanded: !l.expanded } : l)
              };
          })
      })),
    
  addAsset: (asset) => set((state) => ({
      assets: [...state.assets, { ...asset, id: asset.id || generateId() }]
  })),
  
  removeAsset: (id) => set((state) => ({
      assets: state.assets.filter(a => a.id !== id)
  })),

  setEditorMode: (mode) => set({ editorMode: mode }),
  setUseGizmo: (use) => set({ useGizmo: use }),
  setPreviewCameraId: (id) => set({ previewCameraId: id }),
  setCameraType: (type) => set({ cameraType: type }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setShowAdvancedBones: (show) => set({ showAdvancedBones: show }),
  setTimelineOpen: (isOpen) => set({ isTimelineOpen: isOpen }),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  setFog: (fogUpdates) => set((state) => ({ fog: { ...state.fog, ...fogUpdates } })),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setAutoKey: (auto) => set({ autoKey: auto }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  
  addKeyframe: (objectId, property, value, boneName, time) => set((state) => {
    let track = state.tracks.find(t => 
        t.targetId === objectId && 
        t.property === property && 
        t.boneName === boneName
    );
    
    const keyTime = time !== undefined ? time : state.currentTime;
    
    const newKeyframe = {
        id: generateId(),
        time: keyTime,
        value,
        interpolation: (typeof value === 'string' ? 'STEP' : 'BEZIER') as InterpolationType
    };

    if (track) {
        const filteredKeys = track.keyframes.filter(k => Math.abs(k.time - keyTime) > 0.01);
        const newKeys = [...filteredKeys, newKeyframe].sort((a, b) => a.time - b.time);
        return {
            tracks: state.tracks.map(t => t.id === track?.id ? { ...t, keyframes: newKeys } : t)
        };
    } else {
        const newTrackId = boneName 
            ? `${objectId}.${boneName}.${property}`
            : `${objectId}.${property}`;
        return {
            tracks: [...state.tracks, {
                id: newTrackId,
                targetId: objectId,
                property,
                boneName,
                keyframes: [newKeyframe]
            }]
        };
    }
  }),

  selectKeyframe: (id, multi) => set((state) => {
    if (multi) {
        const isSelected = state.selectedKeyframeIds.includes(id);
        return {
            selectedKeyframeIds: isSelected 
                ? state.selectedKeyframeIds.filter(kId => kId !== id)
                : [...state.selectedKeyframeIds, id]
        };
    }
    return { selectedKeyframeIds: [id] };
  }),

  updateTrackKeyframes: (trackId: string, keyframes: Keyframe[]) => set((state) => ({
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, keyframes: keyframes.sort((a,b) => a.time - b.time) } : t)
  })),

  removeKeyframe: (trackId, keyframeId) => set((state) => ({
      tracks: state.tracks.map(t => {
          if (t.id !== trackId) return t;
          return {
              ...t,
              keyframes: t.keyframes.filter(k => k.id !== keyframeId)
          };
      }).filter(t => t.keyframes.length > 0)
  })),

  removeKeyframes: (keyframeIds) => set((state) => {
    const idsToRemove = new Set(keyframeIds);
    return {
        tracks: state.tracks.map(t => ({
            ...t,
            keyframes: t.keyframes.filter(k => !idsToRemove.has(k.id))
        })).filter(t => t.keyframes.length > 0),
        selectedKeyframeIds: []
    };
  }),

  setKeyframeInterpolation: (trackId, keyframeId, type) => set((state) => ({
      tracks: state.tracks.map(t => {
          if (t.id !== trackId) return t;
          return {
              ...t,
              keyframes: t.keyframes.map(k => k.id === keyframeId ? { ...k, interpolation: type } : k)
          };
      })
  })),

  triggerCaptureKeyframes: () => set({ captureKeyframesTrigger: Date.now() }),
  triggerAddCamera: () => set({ addCameraTrigger: Date.now() }),
  
  applyAnimationTemplate: (objectId, templateName) => set((state) => ({
       // Simplified placeholder logic
       tracks: state.tracks
  }))
}));
