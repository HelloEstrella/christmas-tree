import React, { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { TreeMode } from './types';

// 预设照片列表（根据你的截图整理）
const PRESET_PHOTOS = [
  '/images/冯子航.jpg', '/images/管浩策.jpg', '/images/管浠媛.jpg', '/images/韩佳朔.jpg',
  '/images/韩伊.jpg', '/images/季明泽.jpg', '/images/李晓慧.jpg', '/images/李欣阳.jpg',
  '/images/刘瑾沂.jpg', '/images/刘祥瑞.jpg', '/images/路淳清.jpg', '/images/孟令雯.jpg',
  '/images/邱一诺.jpg', '/images/宋宥臻.jpg', '/images/王博扬.jpg', '/images/王俊如.jpg',
  '/images/王奕翔.jpg', '/images/王梓洋.jpg', '/images/肖文瀚.jpg', '/images/邢智果.jpg',
  '/images/杨国豪.jpg', '/images/张子珺.jpg', '/images/郑茹一.jpg'
];

// 错误边界组件：防止单张图片加载失败导致整屏黑掉
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error("3D Scene Error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Scene Refreshing</h2>
            <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 border border-[#D4AF37]">Try Again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // 核心状态：mode 控制圣诞树形态
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  
  // 初始值设为预设照片
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(PRESET_PHOTOS);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleMode = () => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  };

  const handleHandPosition = (x: number, y: number, detected: boolean) => {
    setHandPosition({ x, y, detected });
  };

  const handlePhotosUpload = (photos: string[]) => {
    // 用户手动上传后，将新照片合并到原有照片中（或直接替换）
    setUploadedPhotos(photos);
  };

  // 音乐控制逻辑
  useEffect(() => {
    const audio = new Audio('/audio/christmas-music.mp3');
    audio.loop = true;
    audioRef.current = audio;

    const startMusic = async () => {
      if (!audioRef.current) return;
      try {
        await audioRef.current.play();
        window.removeEventListener('click', startMusic);
        window.removeEventListener('touchstart', startMusic);
      } catch (err) {
        console.warn('Music wait for interaction');
      }
    };

    window.addEventListener('click', startMusic);
    window.addEventListener('touchstart', startMusic);

    return () => {
      window.removeEventListener('click', startMusic);
      window.removeEventListener('touchstart', startMusic);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-screen relative bg-[#050d1a]">
      {/* 3D 渲染画布 */}
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 4, 20], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          shadows
        >
          <Suspense fallback={null}>
            <Experience 
              mode={mode} 
              handPosition={handPosition} 
              uploadedPhotos={uploadedPhotos} 
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      {/* 加载进度条 */}
      <Loader 
        containerStyles={{ background: '#050d1a' }} 
        barStyles={{ background: '#D4AF37' }}
      />
      
      {/* UI 控制层 */}
      <UIOverlay 
        mode={mode} 
        onToggle={toggleMode} 
        onPhotosUpload={handlePhotosUpload} 
        hasPhotos={uploadedPhotos.length > 0} 
      />
      
      {/* 手势识别模块 */}
      <GestureController 
        currentMode={mode} 
        onModeChange={setMode} 
        onHandPosition={handleHandPosition} 
      />
    </div>
  );
}