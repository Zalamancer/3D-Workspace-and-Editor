
export type Vector3 = [number, number, number];
export type Euler = [number, number, number];

export enum ObjectType {
  MESH = 'MESH',
  LIGHT = 'LIGHT',
  CAMERA = 'CAMERA',
  MODEL = 'MODEL',
}

export enum ShapeType {
  // 3D
  CUBE = 'CUBE',
  SPHERE = 'SPHERE',
  CYLINDER = 'CYLINDER',
  TORUS = 'TORUS',
  CONE = 'CONE',
  PYRAMID = 'PYRAMID',
  ICOSAHEDRON = 'ICOSAHEDRON',
  
  // 2D (visualized as flat meshes)
  RECTANGLE = 'RECTANGLE',
  ELLIPSE = 'ELLIPSE',
  TRIANGLE = 'TRIANGLE',
  POLYGON = 'POLYGON',
  STAR = 'STAR',
}

export enum LightType {
  POINT = 'POINT',
  AMBIENT = 'AMBIENT',
  DIRECTIONAL = 'DIRECTIONAL',
  SPOT = 'SPOT',
}

export type InterpolationType = 'LINEAR' | 'STEP' | 'BEZIER';
export type CameraType = 'PERSPECTIVE' | 'ORTHOGRAPHIC';

// --- Material System Types ---
export type MaterialLayerType = 
  | 'COLOR' 
  | 'GRADIENT' 
  | 'NOISE' 
  | 'GLASS' 
  | 'OUTLINE' 
  | 'TOON' 
  | 'MATCAP'
  | 'IMAGE'
  | 'LIGHTING'
  | 'DEPTH'
  | 'FRESNEL';

export type LightingModel = 'LAMBERT' | 'PHONG' | 'PHYSICAL' | 'TOON';

export type ProjectionType = 'UV' | 'PLANAR' | 'SPHERICAL' | 'CYLINDRICAL' | 'TRIPLANAR';
export type WrappingType = 'CLAMP' | 'REPEAT' | 'MIRROR';
export type SharpnessType = 'SMOOTH' | 'PIXELATED';

export type DepthOrigin = 'VECTOR' | 'CAMERA';
export type DepthType = 'LINEAR' | 'RADIAL';
export type DepthPositionMode = 'LOCAL' | 'WORLD';

export type FresnelMode = 'MASK' | 'COLOR';
export type ToonPosition = 'CAMERA' | 'LIGHT';

export interface GradientStop {
    id: string;
    color: string;
    offset: number; // 0 to 1
}

export interface MaterialLayer {
  id: string;
  type: MaterialLayerType;
  name: string;
  visible: boolean;
  opacity: number;
  expanded?: boolean; // UI state

  // Color / Gradient / Toon
  color?: string;
  colorB?: string; // For Gradient
  
  // Noise
  scale?: number;
  intensity?: number;

  // Glass
  transmission?: number;
  thickness?: number;
  roughness?: number;
  chromaticAberration?: number;
  ior?: number;

  // Lighting
  lightingType?: LightingModel;
  shininess?: number;
  specularColor?: string;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;

  // Depth (3D Gradient)
  depthOrigin?: DepthOrigin;
  depthType?: DepthType;
  depthPositionMode?: DepthPositionMode;
  depthNear?: number;
  depthFar?: number;
  depthOriginVector?: Vector3;
  gradientStops?: GradientStop[];

  // Fresnel
  fresnelBias?: number;
  fresnelScale?: number;
  fresnelPower?: number;
  fresnelIntensity?: number;
  fresnelFactor?: number;
  fresnelMode?: FresnelMode;

  // Toon
  toonPosition?: ToonPosition;
  toonGradientStops?: GradientStop[];
  toonOffset?: Vector3;
  toonNoise?: number;
  toonNoiseScale?: number;

  // Outline
  width?: number;
  outlineColor?: string;

  // Image Layer
  imageUrl?: string;
  imageMode?: 'MASK' | 'COLOR';
  projection?: ProjectionType;
  wrapping?: WrappingType;
  sharpness?: SharpnessType;
  crop?: boolean;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number; // radians
}

export interface Keyframe {
  id: string;
  time: number;
  value: number | string;
  interpolation: InterpolationType;
}

export interface AnimationTrack {
  id: string;
  targetId: string;
  property: string;
  boneName?: string;
  keyframes: Keyframe[];
}

export interface BoneInfo {
  name: string;
  parentName?: string;
  depth: number;
}

export interface Asset {
  id: string;
  name: string;
  type: 'ANIMATION' | 'MODEL';
  animationName?: string;
  duration?: number;
  sourceModelId?: string;
  sourceModelUrl?: string;
  url?: string;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  visible: boolean;
  
  // Mesh specific
  shape?: ShapeType;
  
  // Material System
  materialLayers: MaterialLayer[]; 

  // Legacy/Fallback (kept for type safety during migration)
  color?: string;
  metalness?: number;
  roughness?: number;
  
  segments?: number;
  radius?: number;

  // Light specific
  lightType?: LightType;
  intensity?: number;
  castShadow?: boolean;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;

  // Camera specific
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;

  // Model specific
  modelUrl?: string;
  availableAnimations?: string[];
  animationDurations?: Record<string, number>;
  activeAnimation?: string;
  bones?: BoneInfo[]; 
  showSkeleton?: boolean; 
}

export interface AppState {
  objects: SceneObject[];
  assets: Asset[];
  selectedId: string | null;
  selectedBone: string | null;
  editorMode: 'translate' | 'rotate' | 'scale';
  useGizmo: boolean; 
  previewCameraId: string | null; 
  cameraType: CameraType;
  isDragging: boolean;
  isExporting: boolean; 
  showAdvancedBones: boolean;
  isTimelineOpen: boolean; 
  isExportModalOpen: boolean;
  
  fog: {
    enabled: boolean;
    color: string;
    near: number;
    far: number;
  };
  
  currentTime: number;
  isPlaying: boolean;
  autoKey: boolean; 
  maxDuration: number;
  tracks: AnimationTrack[];
  selectedKeyframeIds: string[]; 
  
  captureKeyframesTrigger: number; 
  addCameraTrigger: number; 
  
  addObject: (obj: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  selectBone: (objectId: string, boneName: string | null) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  
  // Material Actions
  addMaterialLayer: (objectId: string, type: MaterialLayerType) => void;
  removeMaterialLayer: (objectId: string, layerId: string) => void;
  updateMaterialLayer: (objectId: string, layerId: string, updates: Partial<MaterialLayer>) => void;
  toggleLayerExpand: (objectId: string, layerId: string) => void;

  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;

  setEditorMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  setUseGizmo: (use: boolean) => void;
  setPreviewCameraId: (id: string | null) => void;
  setCameraType: (type: CameraType) => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsExporting: (isExporting: boolean) => void;
  setShowAdvancedBones: (show: boolean) => void;
  setTimelineOpen: (isOpen: boolean) => void; 
  setExportModalOpen: (open: boolean) => void;
  setFog: (fog: Partial<AppState['fog']>) => void;
  
  setPlaying: (playing) => void;
  setAutoKey: (auto: boolean) => void;
  setCurrentTime: (time: number) => void;
  addKeyframe: (objectId: string, property: string, value: number | string, boneName?: string, time?: number) => void;
  selectKeyframe: (id: string, multi: boolean) => void; 
  updateTrackKeyframes: (trackId: string, keyframes: Keyframe[]) => void; 
  removeKeyframe: (trackId: string, keyframeId: string) => void;
  removeKeyframes: (keyframeIds: string[]) => void; 
  setKeyframeInterpolation: (trackId: string, keyframeId: string, type: InterpolationType) => void;
  triggerCaptureKeyframes: () => void;
  triggerAddCamera: () => void;
  applyAnimationTemplate: (objectId: string, templateName: string) => void;
}
