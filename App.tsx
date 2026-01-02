
import React from 'react';
import { Viewport } from './components/Viewport';
import { LeftPanel } from './components/LeftPanel';
import { TopBar } from './components/TopBar';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ExportModal } from './components/ExportModal';
import { useStore } from './store';

const App: React.FC = () => {
  const { isExporting, currentTime, maxDuration, isTimelineOpen } = useStore();

  return (
    <div className="h-screen w-screen bg-[#09090b] text-white overflow-hidden font-sans relative">
      
      {/* 1. Full Screen Viewport */}
      <div className="absolute inset-0 z-0">
          <Viewport />
      </div>

      {/* 2. Top Bar (Floating) */}
      <TopBar />

      {/* 3. Left Panel (Floating) */}
      <div 
        className={`absolute top-4 left-4 w-[260px] z-10 pointer-events-none transition-all duration-300 ${isTimelineOpen ? 'bottom-[280px]' : 'bottom-4'}`}
      >
           <div className="w-full h-full pointer-events-auto rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                <LeftPanel />
           </div>
      </div>

      {/* 4. Right Inspector (Floating) */}
      <div 
        className={`absolute top-4 right-4 w-[280px] z-10 pointer-events-none transition-all duration-300 ${isTimelineOpen ? 'bottom-[280px]' : 'bottom-4'}`}
      >
           <div className="w-full h-full pointer-events-auto rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                <Inspector />
           </div>
      </div>

      {/* 5. Bottom Timeline (Floating, Full Width) */}
      {isTimelineOpen && (
        <div className="absolute bottom-4 left-4 right-4 h-[260px] z-10 pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-300">
             <div className="w-full h-full pointer-events-auto rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                 <Timeline />
             </div>
        </div>
      )}
      
      {/* Render Overlay */}
      {isExporting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center pointer-events-none backdrop-blur-sm">
           <div className="text-2xl font-bold text-white tracking-widest uppercase mb-4">Rendering</div>
           <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-75 ease-linear"
                style={{ width: `${Math.min(100, (currentTime / maxDuration) * 100)}%` }}
              ></div>
           </div>
        </div>
      )}

      {/* Modals */}
      <ExportModal />
    </div>
  );
};

export default App;
