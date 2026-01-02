import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { ObjectType, ShapeType, LightType } from '../types';

export const GeminiAssistant: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const { addObject } = useStore();

    const handleGenerate = async () => {
        if (!prompt.trim() || !process.env.API_KEY) return;
        setLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Generate a list of 3D objects for a scene described as: "${prompt}".`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { 
                                    type: Type.STRING,
                                    description: "Type of the object. Must be 'MESH' or 'LIGHT'." 
                                },
                                shape: { 
                                    type: Type.STRING,
                                    description: "Shape of the mesh. Must be 'CUBE', 'SPHERE', 'TORUS', or 'PLANE'." 
                                },
                                lightType: { 
                                    type: Type.STRING,
                                    description: "Type of light. Must be 'POINT' or 'AMBIENT'."
                                },
                                position: { 
                                    type: Type.ARRAY,
                                    items: { type: Type.NUMBER },
                                    description: "Position [x, y, z]"
                                },
                                color: { 
                                    type: Type.STRING,
                                    description: "Color in hex format (e.g., #ffffff)" 
                                },
                                name: { 
                                    type: Type.STRING,
                                    description: "Name of the object"
                                }
                            },
                            required: ["type", "position", "name"],
                        }
                    }
                },
            });

            const text = response.text;
            if (!text) {
                throw new Error("No response text");
            }
            const generatedObjects = JSON.parse(text);

            if (Array.isArray(generatedObjects)) {
                generatedObjects.forEach((obj: any) => {
                   // Validate types briefly
                   let type = ObjectType.MESH;
                   if(obj.type === 'LIGHT') type = ObjectType.LIGHT;
                   
                   let shape = ShapeType.CUBE;
                   if(obj.shape === 'SPHERE') shape = ShapeType.SPHERE;
                   if(obj.shape === 'TORUS') shape = ShapeType.TORUS;
                   if(obj.shape === 'PLANE') shape = ShapeType.RECTANGLE;

                   let lightType = LightType.POINT;
                   if(obj.lightType === 'AMBIENT') lightType = LightType.AMBIENT;

                   addObject({
                       ...obj,
                       type,
                       shape,
                       lightType
                   });
                });
            }

            setPrompt('');
        } catch (error) {
            console.error("Gemini Error:", error);
            alert("Failed to generate objects. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-glass-900/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 w-full flex flex-col pointer-events-auto mt-4">
             <div className="flex items-center gap-2 mb-3 text-accent font-medium">
                <Sparkles size={16} />
                <span className="text-sm">Nebula AI Assistant</span>
            </div>
            <div className="relative">
                <textarea
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 resize-none h-24 pr-10"
                    placeholder="Describe a scene (e.g., 'A red sphere floating above a blue floor with soft lighting')"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-accent text-black hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>
            {!process.env.API_KEY && (
                 <p className="text-[10px] text-red-400 mt-2">API Key missing in environment.</p>
            )}
        </div>
    );
};