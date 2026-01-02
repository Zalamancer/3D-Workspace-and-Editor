
import React, { useRef, useEffect, Suspense, useMemo, useState, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader, createPortal, ThreeEvent, extend, useGraph } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Grid, Environment, ContactShadows, View, Text, Billboard, useGLTF, useAnimations, MeshTransmissionMaterial, Outlines, MeshDistortMaterial, GradientTexture, useMatcapTexture, useHelper, shaderMaterial } from '@react-three/drei';
import { useStore } from '../store';
import { ObjectType, ShapeType, LightType, SceneObject, MaterialLayer, GradientStop, MaterialLayerType, ProjectionType, WrappingType, SharpnessType, LightingModel, DepthOrigin, DepthType, DepthPositionMode, ToonPosition, FresnelMode } from '../types';
import * as THREE from 'three';

// --- Custom Shader for Depth Material ---
const DepthShaderMaterial = shaderMaterial(
  {
    gradientMap: null,
    near: 0,
    far: 5,
    origin: new THREE.Vector3(0, 0, 0),
    isVectorMode: false, // 0: Camera, 1: Vector
    isRadial: true,
    isWorldPosition: false,
    color: new THREE.Color('#ffffff'),
    opacity: 1.0,
  },
  // Vertex Shader
  `
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;
    
    void main() {
      vPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      vec4 viewPosition = viewMatrix * worldPosition;
      vViewPosition = -viewPosition.xyz; // Positive depth in front of camera
      
      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  // Fragment Shader
  `
    uniform sampler2D gradientMap;
    uniform float near;
    uniform float far;
    uniform vec3 origin;
    uniform bool isVectorMode;
    uniform bool isRadial;
    uniform bool isWorldPosition;
    uniform vec3 color;
    uniform float opacity;
    
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;

    void main() {
      float dist = 0.0;
      
      if (!isVectorMode) {
          // Camera Mode: Use Z depth from view position
          dist = vViewPosition.z;
      } else {
          // Vector Mode
          vec3 targetPos = isWorldPosition ? vWorldPosition : vPosition;
          
          if (isRadial) {
              dist = distance(targetPos, origin);
          } else {
              // Linear along Y axis relative to origin for now
              dist = abs(targetPos.y - origin.y);
          }
      }
      
      // Normalize distance based on range
      float t = smoothstep(near, far, dist);
      
      // Sample Gradient Texture (1D texture)
      vec4 gradientColor = texture2D(gradientMap, vec2(t, 0.5));
      
      gl_FragColor = vec4(gradientColor.rgb * color, gradientColor.a * opacity);
    }
  `
);

// --- Custom Shader for Fresnel Material ---
const FresnelShaderMaterial = shaderMaterial(
  {
    baseColor: new THREE.Color('#000000'),
    fresnelColor: new THREE.Color('#ffffff'),
    bias: 0.1,
    scale: 1.0,
    power: 2.0,
    intensity: 1.0,
    opacity: 1.0,
  },
  // Vertex Shader
  `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 baseColor;
    uniform vec3 fresnelColor;
    uniform float bias;
    uniform float scale;
    uniform float power;
    uniform float intensity;
    uniform float opacity;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel calculation: F = bias + scale * (1.0 - dot(N, V))^power
      float fresnel = bias + scale * pow(1.0 - dot(viewDir, normal), power);
      fresnel = clamp(fresnel, 0.0, 1.0);

      // Mix base color and fresnel color
      vec3 finalColor = mix(baseColor, fresnelColor * intensity, fresnel);

      gl_FragColor = vec4(finalColor, opacity);
    }
  `
);

// --- Custom Shader for Toon Material ---
const ToonShaderMaterial = shaderMaterial(
  {
    color: new THREE.Color('#ffffff'),
    gradientMap: null,
    gradientOffset: new THREE.Vector3(0,0,0),
    noiseStrength: 0,
    noiseScale: 1,
    opacity: 1,
    mode: 0, // 0: Camera, 1: Light
    lightDir: new THREE.Vector3(1, 1, 1).normalize(),
  },
  // Vertex
  `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment
  `
    uniform vec3 color;
    uniform sampler2D gradientMap;
    uniform float opacity;
    uniform int mode;
    uniform vec3 gradientOffset;
    uniform float noiseStrength;
    uniform float noiseScale;
    uniform vec3 lightDir;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    // Simple value noise function
    float hash(vec3 p)  {
        p  = fract( p*0.3183099 + .1 );
        p *= 17.0;
        return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
    }

    float noise( in vec3 x ) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix( hash(i+vec3(0,0,0)), 
                            hash(i+vec3(1,0,0)),f.x),
                       mix( hash(i+vec3(0,1,0)), 
                            hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix( hash(i+vec3(0,0,1)), 
                            hash(i+vec3(1,0,1)),f.x),
                       mix( hash(i+vec3(0,1,1)), 
                            hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewPosition);
      
      float intensity = 0.0;
      
      if (mode == 0) {
          // Camera: Dot product of View and Normal. 
          intensity = dot(N, V);
      } else {
          // Light: Dot product of Light Dir and Normal
          intensity = dot(N, lightDir);
          intensity = intensity * 0.5 + 0.5; // Map -1..1 to 0..1 for full wrap
      }
      
      // Apply Offset (X mainly shifts the ramp)
      intensity += gradientOffset.x;
      
      // Apply Noise
      if (noiseStrength > 0.0) {
          float n = noise(vWorldPosition * noiseScale);
          intensity += (n - 0.5) * noiseStrength;
      }
      
      intensity = clamp(intensity, 0.01, 0.99);
      
      // Sample Gradient
      vec3 grad = texture2D(gradientMap, vec2(intensity, 0.5)).rgb;
      
      gl_FragColor = vec4(grad * color, opacity);
    }
  `
);

extend({ DepthShaderMaterial, FresnelShaderMaterial, ToonShaderMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    depthShaderMaterial: any;
    fresnelShaderMaterial: any;
    toonShaderMaterial: any;
  }
}

// --- Helper Functions ---
function interpolateTrack(track: any, time: number) {
    const keys = track.keyframes;
    if (keys.length === 0) return 0;
    if (keys.length === 1) return keys[0].value;
    
    let prevIndex = keys.findIndex((k: any) => k.time > time) - 1;
    if (prevIndex < -1) prevIndex = keys.length - 1; 
    
    const prevKey = keys[prevIndex < 0 ? 0 : prevIndex];
    const nextKey = keys[prevIndex + 1 < keys.length ? prevIndex + 1 : prevIndex];
    
    if (typeof prevKey.value === 'string' || typeof nextKey.value === 'string') {
        return prevKey.value;
    }

    if (prevKey === nextKey) return prevKey.value;
    
    const duration = nextKey.time - prevKey.time;
    if (duration <= 0) return nextKey.value;
    
    const t = Math.max(0, Math.min(1, (time - prevKey.time) / duration));
    
    if (prevKey.interpolation === 'STEP') return t < 1 ? prevKey.value : nextKey.value;
    if (prevKey.interpolation === 'LINEAR') return prevKey.value + (nextKey.value - prevKey.value) * t;
    if (prevKey.interpolation === 'BEZIER') {
        const t2 = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        return prevKey.value + (nextKey.value - prevKey.value) * t2;
    }
    
    return prevKey.value;
}

// --- Material System Implementation ---

const TextureHandler: React.FC<{ layer: MaterialLayer; meshRef: React.RefObject<THREE.Mesh> }> = ({ layer, meshRef }) => {
    const texture = useLoader(THREE.TextureLoader, layer.imageUrl!);
    
    useLayoutEffect(() => {
        if (!texture) return;
        
        const wrapMode = layer.wrapping === 'REPEAT' ? THREE.RepeatWrapping 
                      : layer.wrapping === 'MIRROR' ? THREE.MirroredRepeatWrapping 
                      : THREE.ClampToEdgeWrapping;
                      
        texture.wrapS = wrapMode;
        texture.wrapT = wrapMode;
        
        texture.magFilter = layer.sharpness === 'PIXELATED' ? THREE.NearestFilter : THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        
        texture.repeat.set(layer.scaleX ?? 1, layer.scaleY ?? 1);
        texture.offset.set(layer.offsetX ?? 0, layer.offsetY ?? 0);
        texture.center.set(0.5, 0.5); 
        texture.rotation = (layer.rotation ?? 0) * (Math.PI / 180); 
        
        texture.needsUpdate = true;
    }, [layer, texture]);

    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const geometry = mesh.geometry;
        if (!geometry.attributes.position || !geometry.attributes.uv) return;

        if (!geometry.userData.originalUV) {
            geometry.userData.originalUV = geometry.attributes.uv.clone();
        }

        const restoreUVs = () => {
             if (geometry.userData.originalUV) {
                (geometry.attributes.uv as THREE.BufferAttribute).copy(geometry.userData.originalUV);
                geometry.attributes.uv.needsUpdate = true;
             }
        };

        if (layer.projection === 'UV') {
            restoreUVs();
            return;
        }

        const posAttribute = geometry.attributes.position;
        const normalAttribute = geometry.attributes.normal;
        const uvAttribute = geometry.attributes.uv;
        const count = posAttribute.count;

        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        const sz = {
            x: size.x || 1,
            y: size.y || 1,
            z: size.z || 1
        };

        const v = new THREE.Vector3();
        const n = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            v.fromBufferAttribute(posAttribute, i);
            const rx = (v.x - bbox.min.x) / sz.x;
            const ry = (v.y - bbox.min.y) / sz.y;
            const rz = (v.z - bbox.min.z) / sz.z;

            let u = 0, t = 0;

            if (layer.projection === 'PLANAR') {
                u = rx; t = ry;
            } 
            else if (layer.projection === 'SPHERICAL') {
                const localV = v.clone().sub(center).normalize();
                u = Math.atan2(localV.x, localV.z) / (2 * Math.PI) + 0.5;
                t = localV.y * 0.5 + 0.5;
            } 
            else if (layer.projection === 'CYLINDRICAL') {
                const localV = v.clone().sub(center).normalize();
                u = Math.atan2(localV.x, localV.z) / (2 * Math.PI) + 0.5;
                t = ry; 
            } 
            else if (layer.projection === 'TRIPLANAR') {
                if (normalAttribute) {
                    n.fromBufferAttribute(normalAttribute, i);
                    const ax = Math.abs(n.x);
                    const ay = Math.abs(n.y);
                    const az = Math.abs(n.z);

                    if (ax > ay && ax > az) {
                        u = rz; t = ry;
                    } else if (ay > ax && ay > az) {
                        u = rx; t = rz;
                    } else {
                        u = rx; t = ry;
                    }
                } else {
                    u = rx; t = ry;
                }
            }
            uvAttribute.setXY(i, u, t);
        }

        uvAttribute.needsUpdate = true;
        return restoreUVs;
    }, [layer.projection, meshRef]);

    return <primitive object={texture} attach="map" />;
};

// Helper to generate gradient texture from stops
const useGradientTexture = (stops: GradientStop[]) => {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 256, 0);
            stops.forEach(stop => {
                grad.addColorStop(stop.offset, stop.color);
            });
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 256, 1);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }, [stops]);
};

const MaterialComposer: React.FC<{ layers: MaterialLayer[]; meshRef: React.RefObject<THREE.Mesh> }> = ({ layers, meshRef }) => {
    const glass = layers.find(l => l.type === 'GLASS' && l.visible);
    const toonLayer = layers.find(l => l.type === 'TOON' && l.visible);
    const matcap = layers.find(l => l.type === 'MATCAP' && l.visible);
    const noise = layers.find(l => l.type === 'NOISE' && l.visible);
    const outline = layers.find(l => l.type === 'OUTLINE' && l.visible);
    const gradient = layers.find(l => l.type === 'GRADIENT' && l.visible);
    const colorLayer = layers.find(l => l.type === 'COLOR' && l.visible);
    const lighting = layers.find(l => l.type === 'LIGHTING' && l.visible);
    const depthLayer = layers.find(l => l.type === 'DEPTH' && l.visible);
    const fresnelLayer = layers.find(l => l.type === 'FRESNEL' && l.visible);
    const imageLayer = layers.find(l => l.type === 'IMAGE' && l.visible && l.imageUrl);

    const [matcapTexture] = useMatcapTexture('C7C7D7_4C4E5A_818393_6C6C74', 512);

    const gradientConfig = useMemo(() => {
        if (!gradient) return null;
        return {
            stops: [0, 1],
            colors: [gradient.color || '#000000', gradient.colorB || '#ffffff']
        };
    }, [gradient]);

    const baseColor = colorLayer?.color || '#ffffff';
    const activeLayerOpacity = glass?.opacity ?? toonLayer?.opacity ?? matcap?.opacity ?? noise?.opacity ?? lighting?.opacity ?? depthLayer?.opacity ?? fresnelLayer?.opacity ?? gradient?.opacity ?? imageLayer?.opacity ?? colorLayer?.opacity ?? 100;
    
    const commonProps = {
        transparent: activeLayerOpacity < 100,
        opacity: activeLayerOpacity / 100,
        depthWrite: true, // Ensure we write to depth for occlusion by helpers
    };

    const renderOutlines = () => (
        outline && (
          <Outlines 
            thickness={outline.width || 0.05} 
            color={outline.outlineColor || 'black'} 
            screenspace={false} 
            transparent={false} 
            opacity={(outline.opacity || 100) / 100} 
          />
        )
    );

    const renderGradientMap = () => (
        gradientConfig && <GradientTexture attach="map" stops={gradientConfig.stops} colors={gradientConfig.colors} size={1024} />
    );
    
    const renderTextureMap = () => (
        imageLayer && <TextureHandler key={imageLayer.imageUrl} layer={imageLayer} meshRef={meshRef} />
    );
    
    // Depth Layer (Custom Shader)
    const depthTexture = useGradientTexture(depthLayer?.gradientStops || []);
    if (depthLayer) {
        return (
            <>
                <depthShaderMaterial 
                    attach="material"
                    gradientMap={depthTexture}
                    near={depthLayer.depthNear || 0}
                    far={depthLayer.depthFar || 5}
                    origin={new THREE.Vector3(...(depthLayer.depthOriginVector || [0,0,0]))}
                    isVectorMode={depthLayer.depthOrigin === 'VECTOR'}
                    isRadial={depthLayer.depthType === 'RADIAL'}
                    isWorldPosition={depthLayer.depthPositionMode === 'WORLD'}
                    color={new THREE.Color(baseColor)}
                    opacity={activeLayerOpacity / 100}
                    transparent={activeLayerOpacity < 100}
                    depthWrite={true}
                />
                {renderOutlines()}
            </>
        )
    }

    // Toon Layer (Custom Shader)
    const toonGradientTexture = useGradientTexture(toonLayer?.toonGradientStops || []);
    if (toonLayer) {
        return (
            <>
                <toonShaderMaterial 
                    attach="material"
                    color={new THREE.Color(toonLayer.color || '#ffffff')}
                    gradientMap={toonGradientTexture}
                    gradientOffset={new THREE.Vector3(...(toonLayer.toonOffset || [0,0,0]))}
                    noiseStrength={toonLayer.toonNoise || 0}
                    noiseScale={toonLayer.toonNoiseScale || 1}
                    opacity={activeLayerOpacity / 100}
                    transparent={activeLayerOpacity < 100}
                    mode={toonLayer.toonPosition === 'LIGHT' ? 1 : 0}
                    // Light Dir hardcoded to match default directional light
                    lightDir={new THREE.Vector3(5, 5, 5).normalize()}
                    depthWrite={true}
                />
                {renderOutlines()}
            </>
        )
    }

    // Fresnel Layer (Custom Shader)
    if (fresnelLayer) {
        return (
            <>
                <fresnelShaderMaterial 
                    attach="material"
                    baseColor={new THREE.Color(baseColor)}
                    fresnelColor={new THREE.Color(fresnelLayer.color || '#ffffff')}
                    bias={fresnelLayer.fresnelBias || 0}
                    scale={fresnelLayer.fresnelScale || 1}
                    power={fresnelLayer.fresnelPower || 2}
                    intensity={fresnelLayer.fresnelIntensity || 1}
                    opacity={activeLayerOpacity / 100}
                    transparent={activeLayerOpacity < 100}
                    depthWrite={true}
                />
                {renderOutlines()}
            </>
        )
    }

    if (glass) {
        return (
            <>
                <MeshTransmissionMaterial 
                    {...commonProps} 
                    color={baseColor} 
                    transmission={glass.transmission || 1} 
                    thickness={glass.thickness || 1.5} 
                    roughness={glass.roughness || 0} 
                    chromaticAberration={glass.chromaticAberration || 0.04} 
                    ior={glass.ior || 1.5} 
                    background={new THREE.Color(baseColor)} 
                    depthWrite={true}
                />
                {renderOutlines()}
            </>
        );
    }
    if (matcap) {
        return (
            <>
                <meshMatcapMaterial {...commonProps} color={baseColor} matcap={matcapTexture} depthWrite={true}>
                     {renderGradientMap()}
                     {renderTextureMap()}
                </meshMatcapMaterial>
                {renderOutlines()}
            </>
        );
    }
    if (noise) {
        return (
            <>
                <MeshDistortMaterial {...commonProps} color={!gradient && !imageLayer ? baseColor : '#ffffff'} distort={noise.intensity || 0.4} speed={2} radius={noise.scale || 1} depthWrite={true}>
                    {renderGradientMap()}
                    {renderTextureMap()}
                </MeshDistortMaterial>
                {renderOutlines()}
            </>
        );
    }

    if (lighting) {
        if (lighting.lightingType === 'LAMBERT') {
            return (
                <>
                    <meshLambertMaterial {...commonProps} color={!gradient && !imageLayer ? baseColor : '#ffffff'} depthWrite={true}>
                         {renderGradientMap()}
                         {renderTextureMap()}
                    </meshLambertMaterial>
                    {renderOutlines()}
                </>
            );
        }
        if (lighting.lightingType === 'PHONG') {
            return (
                <>
                    <meshPhongMaterial 
                        {...commonProps} 
                        color={!gradient && !imageLayer ? baseColor : '#ffffff'}
                        shininess={lighting.shininess || 30}
                        specular={lighting.specularColor || '#111111'}
                        depthWrite={true}
                    >
                         {renderGradientMap()}
                         {renderTextureMap()}
                    </meshPhongMaterial>
                    {renderOutlines()}
                </>
            );
        }
        // Physical Fallthrough
        return (
            <>
                <meshPhysicalMaterial 
                    {...commonProps} 
                    color={!gradient && !imageLayer ? baseColor : '#ffffff'} 
                    metalness={lighting.metalness || 0} 
                    roughness={lighting.roughness || 0.5}
                    clearcoat={lighting.clearcoat || 0}
                    clearcoatRoughness={lighting.clearcoatRoughness || 0}
                    depthWrite={true}
                >
                    {renderGradientMap()}
                    {renderTextureMap()}
                </meshPhysicalMaterial>
                {renderOutlines()}
            </>
        );
    }

    // Default Fallback
    return (
        <>
            <meshPhysicalMaterial {...commonProps} color={!gradient && !imageLayer ? baseColor : '#ffffff'} metalness={0.1} roughness={0.5} depthWrite={true}>
                {renderGradientMap()}
                {renderTextureMap()}
            </meshPhysicalMaterial>
            {renderOutlines()}
        </>
    );
};

// --- Viewport Components (Merged) ---

const CameraSpawner: React.FC = () => {
    const { addCameraTrigger, addObject } = useStore();
    const { camera } = useThree();
    const prevTrigger = useRef(0);

    useEffect(() => {
        if (addCameraTrigger !== prevTrigger.current && addCameraTrigger !== 0) {
            prevTrigger.current = addCameraTrigger;
            const pos = new THREE.Vector3();
            const rot = new THREE.Euler();
            camera.updateMatrixWorld();
            pos.setFromMatrixPosition(camera.matrixWorld);
            rot.setFromRotationMatrix(camera.matrixWorld);

            addObject({
                type: ObjectType.CAMERA,
                name: 'New Camera',
                position: [pos.x, pos.y, pos.z],
                rotation: [rot.x, rot.y, rot.z],
                fov: (camera as THREE.PerspectiveCamera).fov || 75
            });
        }
    }, [addCameraTrigger, addObject, camera]);
    return null;
}

const TimeController: React.FC = () => {
    const { isPlaying, isExporting, currentTime, maxDuration, setCurrentTime } = useStore();
    useFrame((state, delta) => {
        if (isExporting) {
            if (!isPlaying) return;
            const step = 1 / 30;
            const nextTime = currentTime + step;
            if (currentTime < maxDuration) {
                setCurrentTime(Math.min(nextTime, maxDuration));
            }
        } else if (isPlaying) {
            let nextTime = currentTime + delta;
            if (nextTime >= maxDuration) nextTime = 0;
            setCurrentTime(nextTime);
        }
    });
    return null;
};

// --- Bone Interaction Components ---

const BoneDot: React.FC<{ 
    bone: THREE.Bone; 
    isSelected: boolean; 
    onInteractionStart: (e: ThreeEvent<PointerEvent>, bone: THREE.Bone) => void; 
}> = ({ bone, isSelected, onInteractionStart }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // Sync position with bone
    useFrame(() => {
        if (meshRef.current && bone) {
            const worldPos = new THREE.Vector3();
            bone.getWorldPosition(worldPos);
            meshRef.current.position.copy(worldPos);
        }
    });

    return (
        <mesh
            ref={meshRef}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            onPointerDown={(e) => {
                e.stopPropagation();
                onInteractionStart(e, bone);
            }}
            renderOrder={999} // Render after scene objects
        >
            <sphereGeometry args={[hovered || isSelected ? 0.06 : 0.035, 16, 16]} />
            <meshBasicMaterial 
                color={hovered || isSelected ? '#3b82f6' : 'white'} 
                depthTest={true} // Test depth so it's hidden behind objects
                depthWrite={true}
                transparent 
                opacity={0.8}
            />
            {/* Hit area larger than visible dot */}
            <mesh visible={false}>
                <sphereGeometry args={[0.15, 8, 8]} />
            </mesh>
        </mesh>
    );
};

const BoneInteractiveLayer: React.FC<{ 
    skeleton: THREE.Skeleton; 
    objectId: string; 
}> = ({ skeleton, objectId }) => {
    const { selectBone, selectedBone, setIsDragging, addKeyframe, autoKey, updateObject } = useStore();
    const { camera, gl } = useThree();
    
    // Drag State
    const dragRef = useRef<{
        active: boolean;
        bone: THREE.Bone | null;
        mode: 'ROTATE' | 'TRANSLATE';
        startX: number;
        startY: number;
        startRot: THREE.Quaternion;
        startPos: THREE.Vector3; // Local position
        startWorldPos: THREE.Vector3;
        plane: THREE.Plane;
    } | null>(null);

    const handleInteractionStart = (e: ThreeEvent<PointerEvent>, bone: THREE.Bone) => {
        // Mode decision: Cmd/Ctrl = Translate, Default = Rotate
        const mode = (e.metaKey || e.ctrlKey) ? 'TRANSLATE' : 'ROTATE';
        
        selectBone(objectId, bone.name);
        setIsDragging(true);

        const worldPos = new THREE.Vector3();
        bone.getWorldPosition(worldPos);
        
        // Plane for translation (facing camera)
        const planeNormal = new THREE.Vector3();
        camera.getWorldDirection(planeNormal).negate();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, worldPos);

        dragRef.current = {
            active: true,
            bone,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            startRot: bone.quaternion.clone(),
            startPos: bone.position.clone(),
            startWorldPos: worldPos,
            plane
        };
    };

    useEffect(() => {
        const onPointerMove = (e: PointerEvent) => {
            if (!dragRef.current || !dragRef.current.active || !dragRef.current.bone) return;

            const { bone, mode, startX, startY, startRot, startPos, startWorldPos, plane } = dragRef.current;

            if (mode === 'ROTATE') {
                // Gyro-like Rotation (Trackball style logic)
                const deltaX = (e.clientX - startX) * 0.005;
                const deltaY = (e.clientY - startY) * 0.005;

                const cameraRot = new THREE.Quaternion().setFromEuler(camera.rotation);
                
                // Axis in view space
                const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraRot).normalize();
                const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraRot).normalize();

                const qx = new THREE.Quaternion().setFromAxisAngle(axisY, deltaX);
                const qy = new THREE.Quaternion().setFromAxisAngle(axisX, deltaY);
                
                const viewDeltaRot = qy.multiply(qx); 
                
                const parentWorldQuat = new THREE.Quaternion();
                if (bone.parent) {
                    bone.parent.getWorldQuaternion(parentWorldQuat);
                }
                const parentWorldInverse = parentWorldQuat.clone().invert();
                
                // Reconstruct Start World Rotation from Parent + Start Local
                const startWorldQuat = parentWorldQuat.clone().multiply(startRot);
                
                // Apply delta in world space
                const newWorldQuat = viewDeltaRot.multiply(startWorldQuat);
                
                // Convert back to local
                const newLocalQuat = parentWorldInverse.multiply(newWorldQuat);
                
                bone.quaternion.copy(newLocalQuat);

            } else {
                // Translation
                // Project mouse to plane
                const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
                const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
                
                const targetPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, targetPoint);
                
                if (targetPoint) {
                    const parent = bone.parent;
                    if (parent) {
                        const invParentMatrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();
                        const localTarget = targetPoint.clone().applyMatrix4(invParentMatrix);
                        bone.position.copy(localTarget);
                    } else {
                        bone.position.copy(targetPoint);
                    }
                }
            }
        };

        const onPointerUp = () => {
            if (dragRef.current && dragRef.current.active) {
                const { bone, mode } = dragRef.current;
                
                // Commit changes (Auto Key)
                if (autoKey && bone) {
                    if (mode === 'ROTATE') {
                         addKeyframe(objectId, 'rotation.x', bone.rotation.x, bone.name);
                         addKeyframe(objectId, 'rotation.y', bone.rotation.y, bone.name);
                         addKeyframe(objectId, 'rotation.z', bone.rotation.z, bone.name);
                    } else {
                         addKeyframe(objectId, 'position.x', bone.position.x, bone.name);
                         addKeyframe(objectId, 'position.y', bone.position.y, bone.name);
                         addKeyframe(objectId, 'position.z', bone.position.z, bone.name);
                    }
                }
            }
            dragRef.current = null;
            setIsDragging(false);
            document.body.style.cursor = 'auto';
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [camera, objectId, addKeyframe, autoKey, setIsDragging]);

    return (
        <group>
            {skeleton.bones
                .filter(bone => !bone.name.toLowerCase().includes('twist'))
                .map((bone) => (
                <BoneDot 
                    key={bone.uuid} 
                    bone={bone} 
                    isSelected={selectedBone === bone.name} 
                    onInteractionStart={handleInteractionStart} 
                />
            ))}
        </group>
    );
}

// --- Visual Helpers ---

interface RotationVisualsProps {
    position: THREE.Vector3;
    startQuat: THREE.Quaternion;
    axis: string;
    startAngle: number;
    totalRotation: number;
}

const RotationVisuals: React.FC<RotationVisualsProps> = ({ position, startQuat, axis, totalRotation }) => {
    let axisRotation = new THREE.Euler(0, 0, 0);
    let color = '#ffffff';

    if (axis === 'x') {
        axisRotation = new THREE.Euler(0, Math.PI / 2, 0); 
        color = '#ff3653';
    } else if (axis === 'y') {
        axisRotation = new THREE.Euler(-Math.PI / 2, 0, 0);
        color = '#8adb00';
    } else if (axis === 'z') {
        axisRotation = new THREE.Euler(0, 0, 0);
        color = '#2c8fdf';
    }

    return (
        <group position={position} quaternion={startQuat}>
             <group rotation={axisRotation}>
                 {/* Background Ring */}
                <mesh>
                    <ringGeometry args={[1.0, 1.05, 64]} />
                    <meshBasicMaterial color={color} opacity={0.2} transparent side={THREE.DoubleSide} depthTest={true} />
                </mesh>
                
                {/* Active Arc */}
                <mesh>
                    <ringGeometry args={[1.0, 1.15, 64, 1, 0, totalRotation]} />
                    <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={true} />
                </mesh>
             </group>
             
             <Billboard position={[1.5, 1.5, 1.5]}> 
                <Text
                    fontSize={0.4}
                    color={color}
                    outlineWidth={0.04}
                    outlineColor="#000000"
                    renderOrder={1000}
                    onSync={(text: any) => {
                        if (text.material) {
                            text.material.depthTest = true;
                            text.material.depthWrite = true;
                        }
                    }}
                >
                    {(totalRotation * 180 / Math.PI).toFixed(0)}°
                </Text>
            </Billboard>
        </group>
    );
};

// --- Custom Single Octant Gizmo ---
const CustomGizmo: React.FC = () => {
    const { selectedId, selectedBone, updateObject, setIsDragging, useGizmo, addKeyframe, autoKey } = useStore();
    const { camera, scene, raycaster, pointer } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    
    // Interaction State
    const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
    const [axisSigns, setAxisSigns] = useState<{ x: number, y: number, z: number }>({ x: 1, y: 1, z: 1 });

    // UI State for Rotation Visuals
    const [dragState, setDragState] = useState<{
        mode: 'translate' | 'scale' | 'rotate';
        axis: string;
        startAngle: number;
        totalRotation: number;
        startQuat: THREE.Quaternion;
        startPos: THREE.Vector3;
    } | null>(null);

    // Config
    const AXIS_LENGTH = 1.0;
    const ARROW_POS = 1.1;
    const CUBE_POS = 0.8;
    const ARC_RADIUS = 0.8;
    const PLANAR_OFFSET = 0.35;
    const COLORS = { x: '#ff3653', y: '#8adb00', z: '#2c8fdf', w: '#ffffff', hover: '#fbbf24' }; 

    // Mutable state for logic
    const dragging = useRef<{
        mode: 'translate' | 'scale' | 'rotate';
        axis: string; 
        startPoint: THREE.Vector3;
        startPos: THREE.Vector3;
        startRot: THREE.Euler;
        startScale: THREE.Vector3;
        startQuat: THREE.Quaternion;
        plane: THREE.Plane;
        localStartVec?: THREE.Vector3; 
        prevAngle?: number; 
        accumulatedRotation?: number; 
    } | null>(null);

    // Update Gizmo Transform & Signs
    useFrame(() => {
        if (!selectedId || !groupRef.current) return;
        let target = scene.getObjectByName(selectedId);
        if (!target) return;

        // If a bone is selected, try to find it within the target model
        if (selectedBone) {
            const bone = target.getObjectByName(selectedBone);
            if (bone) target = bone;
        }

        // Follow object
        target.updateWorldMatrix(true, false);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        target.matrixWorld.decompose(position, quaternion, scale);
        
        groupRef.current.position.copy(position);
        groupRef.current.quaternion.copy(quaternion);

        // Constant Scale
        const dist = camera.position.distanceTo(position);
        const s = dist * 0.12; 
        groupRef.current.scale.set(s, s, s);

        // Determine Axis Signs (Flip to face camera)
        if (!dragging.current) {
            const camPos = camera.position.clone();
            const toCam = camPos.sub(position).normalize();
            
            const xDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
            const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
            const zDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

            const newSigns = {
                x: xDir.dot(toCam) < -0.1 ? -1 : 1,
                y: yDir.dot(toCam) < -0.1 ? -1 : 1,
                z: zDir.dot(toCam) < -0.1 ? -1 : 1
            };
            
            if (newSigns.x !== axisSigns.x || newSigns.y !== axisSigns.y || newSigns.z !== axisSigns.z) {
                setAxisSigns(newSigns);
            }
        }
    });

    const handlePointerDown = (e: any, mode: 'translate' | 'scale' | 'rotate', axis: string) => {
        e.stopPropagation();
        if (!selectedId || !groupRef.current) return;
        
        let target = scene.getObjectByName(selectedId);
        if (!target) return;
        if (selectedBone) {
             const bone = target.getObjectByName(selectedBone);
             if (bone) target = bone;
        }

        setIsDragging(true);

        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        target.getWorldPosition(worldPos);
        target.getWorldQuaternion(worldQuat);

        const plane = new THREE.Plane();
        const normal = new THREE.Vector3();

        if (mode === 'translate' && axis.length === 1) {
             const axisVec = new THREE.Vector3();
             if(axis === 'x') axisVec.set(1,0,0);
             if(axis === 'y') axisVec.set(0,1,0);
             if(axis === 'z') axisVec.set(0,0,1);
             axisVec.applyQuaternion(worldQuat).normalize(); 

             const eye = camera.position.clone().sub(worldPos).normalize();
             const projection = axisVec.clone().multiplyScalar(eye.dot(axisVec));
             const perp = eye.clone().sub(projection);
             
             if (perp.lengthSq() > 0.0001) {
                 normal.copy(perp).normalize();
             } else {
                 normal.crossVectors(axisVec, new THREE.Vector3(0,1,0)); 
                 if (normal.lengthSq() < 0.0001) normal.crossVectors(axisVec, new THREE.Vector3(1,0,0));
                 normal.normalize();
             }
        } 
        else if (mode === 'translate' && axis.length === 2) {
             if (axis === 'xy') normal.set(0, 0, 1).applyQuaternion(worldQuat);
             if (axis === 'yz') normal.set(1, 0, 0).applyQuaternion(worldQuat);
             if (axis === 'xz') normal.set(0, 1, 0).applyQuaternion(worldQuat);
        } else if (mode === 'rotate') {
             if (axis === 'z') normal.set(0, 0, 1).applyQuaternion(worldQuat);
             if (axis === 'x') normal.set(1, 0, 0).applyQuaternion(worldQuat);
             if (axis === 'y') normal.set(0, 1, 0).applyQuaternion(worldQuat);
        } else {
             camera.getWorldDirection(normal);
             normal.negate();
        }
        plane.setFromNormalAndCoplanarPoint(normal, worldPos);

        raycaster.setFromCamera(pointer, camera);
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersect);

        let localStartVec;
        let startAngle = 0;
        
        if (mode === 'rotate' && intersect) {
             const center = worldPos.clone();
             const vStart = intersect.clone().sub(center);
             const invQuat = worldQuat.clone().invert();
             localStartVec = vStart.applyQuaternion(invQuat);
             
             if (axis === 'z') startAngle = Math.atan2(localStartVec.y, localStartVec.x);
             if (axis === 'x') startAngle = Math.atan2(localStartVec.z, localStartVec.y);
             if (axis === 'y') startAngle = Math.atan2(localStartVec.x, localStartVec.z);
        }

        dragging.current = {
            mode,
            axis,
            startPoint: intersect || new THREE.Vector3(),
            startPos: target.position.clone(),
            startRot: target.rotation.clone(),
            startScale: target.scale.clone(),
            startQuat: target.quaternion.clone(),
            plane,
            localStartVec,
            prevAngle: startAngle,
            accumulatedRotation: 0,
        };

        setDragState({ 
            mode, 
            axis, 
            startAngle, 
            totalRotation: 0,
            startQuat: worldQuat.clone(),
            startPos: worldPos.clone()
        });
    };

    useEffect(() => {
        const onPointerMove = () => {
            if (!dragging.current || !selectedId) return;
            let target = scene.getObjectByName(selectedId);
            if (!target) return;
            if (selectedBone) {
                 const bone = target.getObjectByName(selectedBone);
                 if (bone) target = bone;
            }

            raycaster.setFromCamera(pointer, camera);
            const currentPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragging.current.plane, currentPoint);
            
            if (!currentPoint) return;

            const deltaVector = currentPoint.clone().sub(dragging.current.startPoint);
            const worldQuat = dragging.current.startQuat.clone();
            const inverseQuat = worldQuat.clone().invert();
            const localDelta = deltaVector.clone().applyQuaternion(inverseQuat);

            const { mode, axis, startPos, startScale, prevAngle, accumulatedRotation } = dragging.current;

            if (mode === 'translate') {
                if (axis.length === 1) {
                     const axisVec = new THREE.Vector3();
                     if (axis === 'x') axisVec.set(1, 0, 0);
                     if (axis === 'y') axisVec.set(0, 1, 0);
                     if (axis === 'z') axisVec.set(0, 0, 1);
                     axisVec.applyQuaternion(worldQuat).normalize();
                     
                     const projectedDist = deltaVector.dot(axisVec);
                     const worldMove = axisVec.multiplyScalar(projectedDist);
                     
                     const newWorldPos = dragging.current.plane.projectPoint(startPos.clone().add(worldMove), new THREE.Vector3());
                   
                     target.position.set(startPos.x, startPos.y, startPos.z);
                     if(axis === 'x') target.translateX(localDelta.x);
                     if(axis === 'y') target.translateY(localDelta.y);
                     if(axis === 'z') target.translateZ(localDelta.z);
                     
                     if (!selectedBone) {
                        updateObject(selectedId, { position: [target.position.x, target.position.y, target.position.z] });
                     }
                } else {
                     target.position.set(startPos.x, startPos.y, startPos.z);
                     const move = new THREE.Vector3();
                     if (axis.includes('x')) move.x = localDelta.x;
                     if (axis.includes('y')) move.y = localDelta.y;
                     if (axis.includes('z')) move.z = localDelta.z;
                     target.position.add(move);
                     
                     if (!selectedBone) {
                        updateObject(selectedId, { position: [target.position.x, target.position.y, target.position.z] });
                     }
                }
            } 
            else if (mode === 'scale') {
                 const newScale = startScale.clone();
                 let delta = 0;
                 if (axis === 'x') delta = localDelta.x;
                 if (axis === 'y') delta = localDelta.y;
                 if (axis === 'z') delta = localDelta.z;
                 
                 if (axis === 'x') delta *= axisSigns.x;
                 if (axis === 'y') delta *= axisSigns.y;
                 if (axis === 'z') delta *= axisSigns.z;

                 if (axis === 'x') newScale.x += delta;
                 if (axis === 'y') newScale.y += delta;
                 if (axis === 'z') newScale.z += delta;
                 
                 target.scale.copy(newScale);
                 if (!selectedBone) {
                    updateObject(selectedId, { scale: [target.scale.x, target.scale.y, target.scale.z] });
                 }
            }
            else if (mode === 'rotate') {
                const center = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
                const vCurr = currentPoint.clone().sub(center);
                
                const invQuat = worldQuat.clone().invert();
                const localCurr = vCurr.clone().applyQuaternion(invQuat);
                let currAngle = 0;
                if (axis === 'z') currAngle = Math.atan2(localCurr.y, localCurr.x);
                if (axis === 'x') currAngle = Math.atan2(localCurr.z, localCurr.y);
                if (axis === 'y') currAngle = Math.atan2(localCurr.x, localCurr.z);

                let deltaAngle = currAngle - (prevAngle || 0);
                if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

                const newTotalRot = (accumulatedRotation || 0) + deltaAngle;
                dragging.current.accumulatedRotation = newTotalRot;
                dragging.current.prevAngle = currAngle;

                const axisVec = new THREE.Vector3();
                if (axis === 'x') axisVec.set(1, 0, 0);
                if (axis === 'y') axisVec.set(0, 1, 0);
                if (axis === 'z') axisVec.set(0, 0, 1);

                target.quaternion.copy(dragging.current.startQuat);
                target.rotateOnAxis(axisVec, newTotalRot);
                
                const euler = new THREE.Euler().setFromQuaternion(target.quaternion);
                
                if (!selectedBone) {
                    updateObject(selectedId, { rotation: [euler.x, euler.y, euler.z] });
                }

                setDragState(prev => prev ? { ...prev, totalRotation: newTotalRot } : null);
            }
        };

        const onPointerUp = () => {
            if (dragging.current && selectedId) {
                let target = scene.getObjectByName(selectedId);
                if (target) {
                    if (selectedBone) {
                        const bone = target.getObjectByName(selectedBone);
                        if (bone) target = bone;
                    }

                    const p = target.position;
                    const r = target.rotation; 
                    const s = target.scale;
                    
                    if (!selectedBone) {
                        updateObject(selectedId, {
                            position: [p.x, p.y, p.z],
                            rotation: [r.x, r.y, r.z],
                            scale: [s.x, s.y, s.z]
                        });
                    }

                    if (autoKey) {
                        const { mode, axis } = dragging.current;
                        const boneName = selectedBone || undefined;
                        
                        const keyProp = (prop: string, val: number, suffix: string) => {
                             addKeyframe(selectedId, `${prop}.${suffix}`, val, boneName);
                        };

                        if (mode === 'translate') {
                             if (axis.includes('x')) keyProp('position', p.x, 'x');
                             if (axis.includes('y')) keyProp('position', p.y, 'y');
                             if (axis.includes('z')) keyProp('position', p.z, 'z');
                        }
                        else if (mode === 'rotate') {
                             keyProp('rotation', r.x, 'x');
                             keyProp('rotation', r.y, 'y');
                             keyProp('rotation', r.z, 'z');
                        }
                        else if (mode === 'scale') {
                             if (axis.includes('x')) keyProp('scale', s.x, 'x');
                             if (axis.includes('y')) keyProp('scale', s.y, 'y');
                             if (axis.includes('z')) keyProp('scale', s.z, 'z');
                        }
                    }
                }
            }
            setIsDragging(false);
            dragging.current = null;
            setDragState(null);
            setHoveredAxis(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [selectedId, selectedBone, updateObject, scene, raycaster, camera, setIsDragging, autoKey, addKeyframe, axisSigns]);

    if (!selectedId || !useGizmo) return null;
    if (selectedBone) return null; 

    const getAxisColor = (axisId: string, baseColor: string) => {
        if (hoveredAxis === axisId || (dragState?.axis === axisId)) return COLORS.hover;
        return baseColor;
    };

    const sX = axisSigns.x;
    const sY = axisSigns.y;
    const sZ = axisSigns.z;
    const isRotating = dragState?.mode === 'rotate';

    const getQuadrantRotation = (u: number, v: number) => {
        if (u === 1 && v === 1) return 0;
        if (u === -1 && v === 1) return Math.PI / 2;
        if (u === -1 && v === -1) return Math.PI;
        if (u === 1 && v === -1) return -Math.PI / 2;
        return 0;
    };

    return (
        <>
            <group ref={groupRef} renderOrder={999}>
                {!isRotating && (
                    <>
                        <group onPointerOver={() => setHoveredAxis('x')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'x')}>
                            <mesh position={[sX * AXIS_LENGTH/2, 0, 0]} rotation={[0, 0, -Math.PI/2 * sX]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('x', COLORS.x)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                            <mesh position={[sX * ARROW_POS, 0, 0]} rotation={[0, 0, -Math.PI/2 * sX]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('x', COLORS.x)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                        </group>
                        
                        <group onPointerOver={() => setHoveredAxis('y')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'y')}>
                            <mesh position={[0, sY * AXIS_LENGTH/2, 0]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('y', COLORS.y)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                            <mesh position={[0, sY * ARROW_POS, 0]} rotation={[sY === -1 ? Math.PI : 0, 0, 0]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('y', COLORS.y)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                        </group>

                        <group onPointerOver={() => setHoveredAxis('z')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'z')}>
                            <mesh position={[0, 0, sZ * AXIS_LENGTH/2]} rotation={[Math.PI/2 * sZ, 0, 0]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('z', COLORS.z)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                            <mesh position={[0, 0, sZ * ARROW_POS]} rotation={[Math.PI/2 * sZ, 0, 0]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('z', COLORS.z)} toneMapped={false} depthTest={true} depthWrite={true} transparent opacity={1} />
                            </mesh>
                        </group>
                        
                        <group rotation={[0, 0, getQuadrantRotation(sX, sY)]}>
                             <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'z')} onPointerOver={() => setHoveredAxis('rz')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('rz', COLORS.z)} toneMapped={false} depthTest={true} depthWrite={true} transparent side={THREE.DoubleSide} />
                            </mesh>
                        </group>
                        <group rotation={[0, -Math.PI/2, getQuadrantRotation(sZ, sY)]}>
                            <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'x')} onPointerOver={() => setHoveredAxis('rx')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('rx', COLORS.x)} toneMapped={false} depthTest={true} depthWrite={true} transparent side={THREE.DoubleSide} />
                            </mesh>
                        </group>
                        <group rotation={[Math.PI/2, 0, getQuadrantRotation(sX, sZ)]}>
                            <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'y')} onPointerOver={() => setHoveredAxis('ry')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('ry', COLORS.y)} toneMapped={false} depthTest={true} depthWrite={true} transparent side={THREE.DoubleSide} />
                            </mesh>
                        </group>
                    </>
                )}
            </group>

            {isRotating && dragState && (
                <RotationVisuals 
                    position={dragState.startPos}
                    startQuat={dragState.startQuat}
                    axis={dragState.axis}
                    startAngle={dragState.startAngle}
                    totalRotation={dragState.totalRotation}
                />
            )}
        </>
    );
};

// --- External Animation Helper ---
const ExternalAnimPlayer: React.FC<{ url: string; name: string; mixer: THREE.AnimationMixer }> = ({ url, name, mixer }) => {
    const { animations } = useGLTF(url) as any;
    
    useEffect(() => {
        if (!animations || !mixer) return;
        
        const clip = animations.find((c: any) => c.name === name);
        if (clip) {
            mixer.stopAllAction();
            const action = mixer.clipAction(clip);
            action.reset().fadeIn(0.2).play();
            return () => {
                action.fadeOut(0.2);
            }
        }
    }, [animations, name, mixer]);

    return null;
}

const ModelRenderer: React.FC<{ object: SceneObject; isSelected: boolean }> = ({ object, isSelected }) => {
    const { updateObject, isExporting, isExportModalOpen, tracks, currentTime, isDragging, selectedId, selectBone, selectedBone, assets } = useStore();
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(object.modelUrl || '') as any;
    const { actions, mixer } = useAnimations(animations, group);
    const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null);
    
    useEffect(() => {
        if (!scene) return;
        
        const boneList: any[] = [];
        let skel: THREE.Skeleton | null = null;

        scene.traverse((child: any) => {
            if (child.isSkinnedMesh && child.skeleton) {
                skel = child.skeleton;
            }
            if (child.isBone) {
                let depth = 0;
                let curr = child.parent;
                while (curr && curr.type !== 'Scene') {
                    depth++;
                    curr = curr.parent;
                }
                boneList.push({ name: child.name, parentName: child.parent?.isBone ? child.parent.name : null, depth });
            }
        });

        if (skel) setSkeleton(skel);

        const animNames = animations.map((clip: any) => clip.name);
        const animDurations: Record<string, number> = {};
        animations.forEach((clip: any) => {
             animDurations[clip.name] = clip.duration;
        });

        if (
            JSON.stringify(object.availableAnimations) !== JSON.stringify(animNames) ||
            (object.bones?.length || 0) !== boneList.length
        ) {
            updateObject(object.id, { 
                availableAnimations: animNames,
                animationDurations: animDurations,
                bones: boneList
            });
        }
    }, [scene, animations, object.id, updateObject]);

    const activeAnimName = object.activeAnimation;
    const isLocalAnim = activeAnimName && actions[activeAnimName];
    const externalAsset = !isLocalAnim && activeAnimName 
        ? assets.find(a => a.type === 'ANIMATION' && a.animationName === activeAnimName) 
        : null;

    useEffect(() => {
        if (!activeAnimName) {
             mixer.stopAllAction();
             return;
        }

        if (isLocalAnim) {
            const action = actions[activeAnimName];
            if(action) {
                mixer.stopAllAction();
                action.reset().fadeIn(0.2).play();
            }
            return () => {
                 if(action) action.fadeOut(0.2);
            };
        }
    }, [activeAnimName, isLocalAnim, actions, mixer]);

    useFrame(() => {
         if (isDragging && selectedId === object.id) return;

         if (group.current) {
             const boneTracks = tracks.filter(t => t.targetId === object.id && t.boneName);
             
             boneTracks.forEach(track => {
                 const bone = group.current?.getObjectByName(track.boneName!);
                 if (bone) {
                     const value = interpolateTrack(track, currentTime);
                     const parts = track.property.split('.');
                     const prop = parts[0]; 
                     const axis = parts[1];

                     if (prop === 'rotation' && typeof value === 'number') {
                         if (axis === 'x') bone.rotation.x = value;
                         if (axis === 'y') bone.rotation.y = value;
                         if (axis === 'z') bone.rotation.z = value;
                     }
                     if (prop === 'position' && typeof value === 'number') {
                         if (axis === 'x') bone.position.x = value;
                         if (axis === 'y') bone.position.y = value;
                         if (axis === 'z') bone.position.z = value;
                     }
                     if (prop === 'scale' && typeof value === 'number') {
                         if (axis === 'x') bone.scale.x = value;
                         if (axis === 'y') bone.scale.y = value;
                         if (axis === 'z') bone.scale.z = value;
                     }
                 }
             });
         }
    });

    return (
        <group ref={group} dispose={null}>
             <primitive object={scene} />
             
             {isSelected && !isExporting && !isExportModalOpen && !selectedBone && (
                 <mesh>
                    <boxGeometry args={[2,2,2]} /> 
                    <meshBasicMaterial wireframe color="blue" transparent opacity={0.2} depthWrite={true} />
                 </mesh>
             )}

             {isSelected && skeleton && object.showSkeleton && (
                 <BoneInteractiveLayer skeleton={skeleton} objectId={object.id} />
             )}

             {externalAsset && externalAsset.sourceModelUrl && (
                 <Suspense fallback={null}>
                     <ExternalAnimPlayer 
                        url={externalAsset.sourceModelUrl} 
                        name={externalAsset.animationName!} 
                        mixer={mixer} 
                     />
                 </Suspense>
             )}
        </group>
    );
}

const SceneObjectRenderer: React.FC<{ object: SceneObject; isSelected: boolean; activeCameraId?: string | null }> = ({ object, isSelected, activeCameraId }) => {
  const { selectObject, tracks, currentTime, isDragging, selectedId, isExporting, isExportModalOpen } = useStore();
  const objectRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  
  const isActiveCamera = object.type === ObjectType.CAMERA && object.id === activeCameraId;
  const hideHelpers = isExporting || isExportModalOpen || isActiveCamera;
  
  useFrame(() => {
     if (!objectRef.current) return;
     
     if (isDragging && selectedId === object.id) {
         return;
     }

     const objectTracks = tracks.filter(t => t.targetId === object.id && !t.boneName);
     
     const newPos = [...object.position];
     const newRot = [...object.rotation];
     const newScale = [...object.scale];

     objectTracks.forEach(track => {
         const value = interpolateTrack(track, currentTime);
         const parts = track.property.split('.');
         const prop = parts[0]; 
         const axis = parts[1];
         if (prop === 'position' && typeof value === 'number') {
             if (axis === 'x') newPos[0] = value;
             if (axis === 'y') newPos[1] = value;
             if (axis === 'z') newPos[2] = value;
         }
         if (prop === 'rotation' && typeof value === 'number') {
             if (axis === 'x') newRot[0] = value;
             if (axis === 'y') newRot[1] = value;
             if (axis === 'z') newRot[2] = value;
         }
         if (prop === 'scale' && typeof value === 'number') {
             if (axis === 'x') newScale[0] = value;
             if (axis === 'y') newScale[1] = value;
             if (axis === 'z') newScale[2] = value;
         }
     });

     objectRef.current.position.set(newPos[0] as number, newPos[1] as number, newPos[2] as number);
     objectRef.current.rotation.set(newRot[0] as number, newRot[1] as number, newRot[2] as number);
     objectRef.current.scale.set(newScale[0] as number, newScale[1] as number, newScale[2] as number);
  });

  const handlePointerDown = (e: any) => {
      if (object.type !== ObjectType.MODEL) {
          e.stopPropagation();
          if (!isExporting && !isExportModalOpen) selectObject(object.id);
      } else if (!isSelected) {
          if (!isExporting && !isExportModalOpen) selectObject(object.id);
      }
  };

  const geometryMap = {
      [ShapeType.CUBE]: <boxGeometry />,
      [ShapeType.SPHERE]: <sphereGeometry />,
      [ShapeType.TORUS]: <torusGeometry args={[0.7, 0.2, 16, 32]} />,
      [ShapeType.CYLINDER]: <cylinderGeometry args={[1, 1, 1, 32]} />,
      [ShapeType.CONE]: <coneGeometry args={[1, 1, 32]} />,
      [ShapeType.PYRAMID]: <coneGeometry args={[1, 1, 4]} />,
      [ShapeType.ICOSAHEDRON]: <icosahedronGeometry />,
      [ShapeType.RECTANGLE]: <planeGeometry args={[1, 1]} />,
      [ShapeType.ELLIPSE]: <circleGeometry args={[0.5, 32]} />,
      [ShapeType.TRIANGLE]: <circleGeometry args={[0.5, 3]} />,
      [ShapeType.POLYGON]: <circleGeometry args={[0.5, 6]} />,
      [ShapeType.STAR]: <octahedronGeometry />,
  };

  return (
        <group 
            ref={objectRef} 
            onClick={handlePointerDown}
            name={object.id}
        >
            {object.type === ObjectType.MESH && (
                <mesh 
                    ref={meshRef}
                    castShadow 
                    receiveShadow
                >
                    {geometryMap[object.shape || ShapeType.CUBE]}
                    <MaterialComposer layers={object.materialLayers} meshRef={meshRef} />
                    
                    {isSelected && !hideHelpers && (
                        <lineSegments>
                            <edgesGeometry args={[new THREE.BoxGeometry()]} />
                            <lineBasicMaterial color="#3b82f6" depthWrite={true} />
                        </lineSegments>
                    )}
                </mesh>
            )}
            
            {object.type === ObjectType.MODEL && (
                 <Suspense fallback={<mesh><boxGeometry /><meshBasicMaterial wireframe color="gray" depthWrite={true}/></mesh>}>
                    <ModelRenderer object={object} isSelected={isSelected} />
                 </Suspense>
            )}
        </group>
  );
};

const CommonScene: React.FC<{ activeCameraId?: string | null; color?: string }> = ({ activeCameraId, color }) => {
    const { objects, selectedId } = useStore();
    return (
        <>
            {color && <color attach="background" args={[color]} />}
            <Environment preset="city" />
            <ambientLight intensity={0.2} />
            <ContactShadows opacity={0.4} scale={20} blur={2} far={4.5} />
            {objects.map(obj => (
                <SceneObjectRenderer 
                    key={obj.id} 
                    object={obj} 
                    isSelected={obj.id === selectedId} 
                    activeCameraId={activeCameraId}
                />
            ))}
        </>
    )
}

export const Viewport: React.FC = () => {
  const { isDragging, selectObject, isExporting, isExportModalOpen, cameraType } = useStore();
  const mainRef = useRef<HTMLDivElement>(null);
  const BG_COLOR = '#2D2E32';

  return (
    <div ref={mainRef} className="w-full h-full relative bg-[#09090b]">
      <Canvas 
        shadows 
        dpr={[1, 1.5]} 
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        eventSource={mainRef}
        onPointerMissed={(e) => {
            if (e.type === 'click' && !isExporting && !isExportModalOpen) selectObject(null);
        }}
      >
        <Suspense fallback={null}>
            <TimeController />
            <CameraSpawner />
            
            <View track={mainRef} index={1}>
                <color attach="background" args={[BG_COLOR]} />
                <CommonScene />
                
                {cameraType === 'PERSPECTIVE' && <PerspectiveCamera makeDefault position={[8, 5, 8]} fov={50} />}
                {cameraType === 'ORTHOGRAPHIC' && <OrthographicCamera makeDefault position={[10, 10, 10]} zoom={40} />}
                
                <OrbitControls makeDefault enabled={!isDragging} />
                <CustomGizmo />
                <Grid infiniteGrid fadeDistance={50} sectionColor="#4facfe" cellColor="#ffffff" sectionThickness={1} cellThickness={0.5} />
            </View>
        </Suspense>
      </Canvas>
    </div>
  );
};
