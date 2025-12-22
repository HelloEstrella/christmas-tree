import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ onModeChange, currentMode, onHandPosition }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false); // 相机开关
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState("Camera Off");
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const lastModeRef = useRef<TreeMode>(currentMode);
  
  // 核心检测循环
  useEffect(() => {
    if (!isActive) {
      stopCamera();
      return;
    }

    let handLandmarker: any = null;
    let animationFrameId: number;

    const init = async () => {
      try {
        setGestureStatus("Loading...");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `/models/hand_landmarker.task`, delegate: "GPU" },
          runningMode: "VIDEO", numHands: 1
        });
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setIsLoaded(true);
            const loop = () => {
              if (handLandmarker && videoRef.current && videoRef.current.readyState === 4) {
                const result = handLandmarker.detectForVideo(videoRef.current, performance.now());
                if (result.landmarks?.length > 0) {
                  processHand(result.landmarks[0]);
                } else {
                  setGestureStatus("No Hand");
                  setHandPos(null);
                }
              }
              animationFrameId = requestAnimationFrame(loop);
            };
            loop();
          };
        }
      } catch (e) {
        setGestureStatus("Error");
        setIsActive(false);
      }
    };

    init();
    return () => {
      cancelAnimationFrame(animationFrameId);
      stopCamera();
      if (handLandmarker) handLandmarker.close();
    };
  }, [isActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsLoaded(false);
    setGestureStatus("Off");
  };

  // 核心识别逻辑：回归“简单直观”模式
  const processHand = (landmarks: any[]) => {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // 1. 位置更新
    const px = (landmarks[0].x + landmarks[9].x) / 2;
    const py = (landmarks[0].y + landmarks[9].y) / 2;
    setHandPos({ x: px, y: py });
    onHandPosition?.(px, py, true);

    // 2. 计算手指伸展数量 (数手指)
    const tips = [indexTip, middleTip, ringTip, pinkyTip];
    const bases = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    let extendedCount = 0;
    tips.forEach((tip, i) => {
      // 如果指尖到手腕距离 > 指根到手腕距离，判定为伸出
      if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(bases[i].x - wrist.x, bases[i].y - wrist.y) * 1.2) {
        extendedCount++;
      }
    });

    // 3. 捏合判定 (拇指和食指距离)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const isPinching = pinchDist < 0.05; // 物理距离小于 0.05

    // 4. 状态切换
    let nextMode = lastModeRef.current;

    if (extendedCount <= 1) {
      // 拳头 -> 圣诞树
      nextMode = TreeMode.FORMED;
      setGestureStatus("RESTORE (Fist)");
    } else if (isPinching && extendedCount >= 1) {
      // 捏合 -> 放大单张
      nextMode = TreeMode.FOCUS;
      setGestureStatus("FOCUS (Pinch)");
    } else if (extendedCount >= 3) {
      // 张开 -> 散开
      nextMode = TreeMode.CHAOS;
      setGestureStatus("SCATTER (Open)");
    }

    if (nextMode !== lastModeRef.current) {
      lastModeRef.current = nextMode;
      onModeChange(nextMode);
    }

    // 绘制骨架（可选，方便你调试）
    draw(landmarks);
  };

  const draw = (landmarks: any[]) => {
    const canvas = canvasRef.current;
    if (!canvas || !videoRef.current) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 2;
    // 简单绘制几个点
    landmarks.forEach(lm => {
      ctx.beginPath(); ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 7);
      ctx.fillStyle = "#228B22"; ctx.fill();
    });
  };

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-auto">
      <div 
        onClick={() => setIsActive(!isActive)}
        className="relative w-[18.75vw] h-[14.0625vw] min-w-[160px] min-h-[120px] border-2 border-[#D4AF37] rounded-lg overflow-hidden bg-black cursor-pointer group"
      >
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#D4AF37] z-10 bg-[#050d1a]">
             <div className="w-10 h-10 border border-dashed border-[#D4AF37] rounded-full flex items-center justify-center mb-2">
                <span className="text-xl">ON</span>
             </div>
             <p className="text-[10px] tracking-widest uppercase">Click to Start</p>
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform -scale-x-100 ${isLoaded ? 'opacity-100' : 'opacity-20'}`} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none" />
        <div className="absolute bottom-2 left-2 z-20 text-[9px] text-[#D4AF37] bg-black/70 px-2 py-0.5 rounded font-mono uppercase">
          {gestureStatus}
        </div>
        <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded bg-black/60 border border-[#D4AF37]/40 text-[#D4AF37] text-[8px]">
          {isActive ? "SHUTDOWN" : "OFF"}
        </div>
      </div>
    </div>
  );
};