
import React, { useRef, useEffect, Suspense, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree, useGraph, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Grid, Environment, ContactShadows, View, Text, Billboard, useGLTF, useAnimations } from '@react-three/drei';
import { useStore } from '../store';
import { ObjectType, ShapeType, LightType, SceneObject } from '../types';
import * as THREE from 'three';
import { SkeletonHelper } from 'three';

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

// --- Internal Components ---

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
            renderOrder={999} // Always on top
        >
            <sphereGeometry args={[hovered || isSelected ? 0.06 : 0.035, 16, 16]} />
            <meshBasicMaterial 
                color={hovered || isSelected ? '#3b82f6' : 'white'} 
                depthTest={false} 
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
                    <meshBasicMaterial color={color} opacity={0.2} transparent side={THREE.DoubleSide} depthTest={false} />
                </mesh>
                
                {/* Active Arc */}
                <mesh>
                    <ringGeometry args={[1.0, 1.15, 64, 1, 0, totalRotation]} />
                    <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} />
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
                            text.material.depthTest = false;
                            text.material.depthWrite = false;
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

    // ... (Existing handlePointerDown logic) ...
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

        // Determine Plane
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
    // Hide gizmo if bone is selected, as we now use dots for interaction
    if (selectedBone) return null; 

    // --- Helper for Hover Colors ---
    const getAxisColor = (axisId: string, baseColor: string) => {
        if (hoveredAxis === axisId || (dragState?.axis === axisId)) return COLORS.hover;
        return baseColor;
    };

    const sX = axisSigns.x;
    const sY = axisSigns.y;
    const sZ = axisSigns.z;
    const isRotating = dragState?.mode === 'rotate';

    // Calculate arc rotation octant helper
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
                         {/* --- X Axis --- */}
                        <group onPointerOver={() => setHoveredAxis('x')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'x')}>
                            <mesh position={[sX * AXIS_LENGTH/2, 0, 0]} rotation={[0, 0, -Math.PI/2 * sX]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('x', COLORS.x)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                            <mesh position={[sX * ARROW_POS, 0, 0]} rotation={[0, 0, -Math.PI/2 * sX]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('x', COLORS.x)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                        </group>
                        
                         {/* --- Y Axis --- */}
                        <group onPointerOver={() => setHoveredAxis('y')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'y')}>
                            <mesh position={[0, sY * AXIS_LENGTH/2, 0]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('y', COLORS.y)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                            <mesh position={[0, sY * ARROW_POS, 0]} rotation={[sY === -1 ? Math.PI : 0, 0, 0]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('y', COLORS.y)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                        </group>

                         {/* --- Z Axis --- */}
                        <group onPointerOver={() => setHoveredAxis('z')} onPointerOut={() => setHoveredAxis(null)} onPointerDown={(e) => handlePointerDown(e, 'translate', 'z')}>
                            <mesh position={[0, 0, sZ * AXIS_LENGTH/2]} rotation={[Math.PI/2 * sZ, 0, 0]} renderOrder={999}>
                                <cylinderGeometry args={[0.03, 0.03, AXIS_LENGTH, 8]} />
                                <meshBasicMaterial color={getAxisColor('z', COLORS.z)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                            <mesh position={[0, 0, sZ * ARROW_POS]} rotation={[Math.PI/2 * sZ, 0, 0]} renderOrder={999}>
                                <coneGeometry args={[0.08, 0.25, 16]} />
                                <meshBasicMaterial color={getAxisColor('z', COLORS.z)} toneMapped={false} depthTest={false} transparent opacity={1} />
                            </mesh>
                        </group>
                        
                        {/* Rotation Arcs */}
                        <group rotation={[0, 0, getQuadrantRotation(sX, sY)]}>
                             <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'z')} onPointerOver={() => setHoveredAxis('rz')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('rz', COLORS.z)} toneMapped={false} depthTest={false} transparent side={THREE.DoubleSide} />
                            </mesh>
                        </group>
                        <group rotation={[0, -Math.PI/2, getQuadrantRotation(sZ, sY)]}>
                            <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'x')} onPointerOver={() => setHoveredAxis('rx')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('rx', COLORS.x)} toneMapped={false} depthTest={false} transparent side={THREE.DoubleSide} />
                            </mesh>
                        </group>
                        <group rotation={[Math.PI/2, 0, getQuadrantRotation(sX, sZ)]}>
                            <mesh onPointerDown={(e) => handlePointerDown(e, 'rotate', 'y')} onPointerOver={() => setHoveredAxis('ry')} onPointerOut={() => setHoveredAxis(null)} renderOrder={999}>
                                <torusGeometry args={[ARC_RADIUS, 0.03, 6, 32, Math.PI/2]} />
                                <meshBasicMaterial color={getAxisColor('ry', COLORS.y)} toneMapped={false} depthTest={false} transparent side={THREE.DoubleSide} />
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
    
    // Extract info on load
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

    // Determine if we need to fetch an external asset
    const activeAnimName = object.activeAnimation;
    const isLocalAnim = activeAnimName && actions[activeAnimName];
    const externalAsset = !isLocalAnim && activeAnimName 
        ? assets.find(a => a.type === 'ANIMATION' && a.animationName === activeAnimName) 
        : null;

    // Play Local Animation
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

    // Apply Manual Bone Keyframes (Post-Animation Override)
    useFrame(() => {
         // If dragging, we handle updates in BoneInteractiveLayer
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
             
             {/* Selection Box for Model */}
             {isSelected && !isExporting && !isExportModalOpen && !selectedBone && (
                 <mesh>
                    <boxGeometry args={[2,2,2]} /> 
                    <meshBasicMaterial wireframe color="blue" transparent opacity={0.2} />
                 </mesh>
             )}

             {/* Bone Interactive Dots */}
             {isSelected && skeleton && object.showSkeleton && (
                 <BoneInteractiveLayer skeleton={skeleton} objectId={object.id} />
             )}

             {/* External Animation Player */}
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
  const isActiveCamera = object.type === ObjectType.CAMERA && object.id === activeCameraId;
  const hideHelpers = isExporting || isExportModalOpen || isActiveCamera;
  
  useFrame(() => {
     if (!objectRef.current) return;
     
     if (isDragging && selectedId === object.id) {
         return;
     }

     // Apply Animations or Store State
     const objectTracks = tracks.filter(t => t.targetId === object.id && !t.boneName);
     
     // Base transform from store
     const newPos = [...object.position];
     const newRot = [...object.rotation];
     const newScale = [...object.scale];

     // Override with keyframes if any
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

     // Apply to Ref
     objectRef.current.position.set(newPos[0] as number, newPos[1] as number, newPos[2] as number);
     objectRef.current.rotation.set(newRot[0] as number, newRot[1] as number, newRot[2] as number);
     objectRef.current.scale.set(newScale[0] as number, newScale[1] as number, newScale[2] as number);
  });

  const handlePointerDown = (e: any) => {
      // For standard meshes, just select. 
      // Models handle their own clicks for bone selection via BoneDots or primitive
      if (object.type !== ObjectType.MODEL) {
          e.stopPropagation();
          if (!isExporting && !isExportModalOpen) selectObject(object.id);
      } else if (!isSelected) {
          // Select model if not already selected
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
      
      // 2D Shapes (using flattened geometries)
      [ShapeType.RECTANGLE]: <planeGeometry args={[1, 1]} />,
      [ShapeType.ELLIPSE]: <circleGeometry args={[0.5, 32]} />,
      [ShapeType.TRIANGLE]: <circleGeometry args={[0.5, 3]} />,
      [ShapeType.POLYGON]: <circleGeometry args={[0.5, 6]} />, // Hexagon default
      [ShapeType.STAR]: <octahedronGeometry />, // Placeholder for star
  };

  return (
        <group 
            ref={objectRef} 
            onClick={handlePointerDown}
            name={object.id}
        >
            {object.type === ObjectType.MESH && (
                <mesh castShadow receiveShadow>
                    {geometryMap[object.shape || ShapeType.CUBE]}
                    <meshStandardMaterial 
                        color={object.color || '#ffffff'} 
                        metalness={object.metalness || 0} 
                        roughness={object.roughness || 0.5} 
                        side={THREE.DoubleSide}
                    />
                    {isSelected && !hideHelpers && (
                        <lineSegments>
                            <edgesGeometry args={[new THREE.BoxGeometry()]} />
                            <lineBasicMaterial color="#3b82f6" />
                        </lineSegments>
                    )}
                </mesh>
            )}
            
            {object.type === ObjectType.MODEL && (
                 <Suspense fallback={<mesh><boxGeometry /><meshBasicMaterial wireframe color="gray"/></mesh>}>
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
