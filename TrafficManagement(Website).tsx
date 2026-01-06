import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Wifi, WifiOff, AlertTriangle, BarChart3, RotateCcw, Volume2, CarFront } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update } from "firebase/database";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB9acFN3r7eyrBlLr8sDa-Obwxz7_pfAvQ",
  authDomain: "final-cap-e14a9.firebaseapp.com",
  databaseURL: "https://final-cap-e14a9-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "final-cap-e14a9",
  storageBucket: "final-cap-e14a9.firebasestorage.app",
  messagingSenderId: "104112052122",
  appId: "1:104112052122:web:29e528fdd3ad92314c8c23",
  measurementId: "G-4DRGEGQR27"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const TrafficManagementDashboard = () => {
  const [mode, setMode] = useState('simulation'); 
  const [systemFunction, setSystemFunction] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  
  const [sensorData, setSensorData] = useState({
    leftLane1Count: 0, leftLane2Count: 0, rightLane1Count: 0, rightLane2Count: 0,
    leftSoundLevel: 45, rightSoundLevel: 45
  });

  const [simVehicles, setSimVehicles] = useState({
    leftLane1: 0, leftLane2: 0, rightLane1: 0, rightLane2: 0
  });

  const vehicleIdCounter = useRef(0);
  const vehiclesRef = useRef([]); 
  const emergencyRef = useRef(null);
  const [emergencyVehicle, setEmergencyVehicle] = useState(null);
  
  const prevLiveCounts = useRef({ left: 0, right: 0 });
  const isFirstLiveLoad = useRef(true);

  const [analyticsData, setAnalyticsData] = useState({
    congestionResponse: [], soundVehicle: [], trafficPattern: []
  });

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [barrierStates, setBarrierStates] = useState({ left: 'raised', middle: 'raised', right: 'raised' });
  const [emergencySide, setEmergencySide] = useState(null);

  useEffect(() => {
    emergencyRef.current = emergencyVehicle;
  }, [emergencyVehicle]);

  // --- BARRIER LOGIC ---
  const getBarrierStates = (func, emergencySide = null) => {
    switch(func) {
      case 0: return { left: 'raised', middle: 'raised', right: 'raised' }; 
      case 1: return { left: 'lowered', middle: 'raised', right: 'lowered' }; 
      case 2: return { left: 'lowered', middle: 'lowered', right: 'raised' }; 
      case 3: return { left: 'raised', middle: 'lowered', right: 'lowered' }; 
      case 4:
        if (emergencySide === 'left') return { left: 'lowered', middle: 'raised', right: 'raised' };
        if (emergencySide === 'right') return { left: 'raised', middle: 'raised', right: 'lowered' };
        return { left: 'raised', middle: 'raised', right: 'raised' };
      default: return { left: 'raised', middle: 'raised', right: 'raised' };
    }
  };

  // --- FIREBASE LISTENER ---
  useEffect(() => {
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => setFirebaseConnected(snap.val() === true));

    const trafficRef = ref(db, 'state'); 
    const unsubscribe = onValue(trafficRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return; 

      if (data.system && data.system.lastUpdate !== lastUpdate) {
          setEsp32Connected(true);
          setLastUpdate(data.system.lastUpdate);
      }

      if (mode === 'live') {
          const leftCars = data.traffic?.left?.cars || 0;
          const rightCars = data.traffic?.right?.cars || 0;
          
          setSensorData({
              leftLane1Count: leftCars, leftLane2Count: 0,
              rightLane1Count: rightCars, rightLane2Count: 0,
              leftSoundLevel: data.emergency?.dbLeft || 45,
              rightSoundLevel: data.emergency?.dbRight || 45
          });

          const sysMode = data.system?.mode || 'NORMAL';
          const emergSide = data.emergency?.side || 'NONE';

          if (sysMode === 'EMERGENCY') {
              setSystemFunction(4);
              setEmergencySide(emergSide === 'NONE' ? null : emergSide.toLowerCase());
              setConfidence(0.99);
          } else {
              setSystemFunction(0); 
              setConfidence(0.85);
          }

          setBarrierStates({
              left: (data.walls?.left || "DOWN") === "UP" ? "lowered" : "raised",
              middle: (data.walls?.middle || "DOWN") === "UP" ? "lowered" : "raised",
              right: (data.walls?.right || "DOWN") === "UP" ? "lowered" : "raised",
          });
      }
    });
    return () => unsubscribe();
  }, [mode, lastUpdate]);

  // --- VEHICLE SPAWN HELPER (ADJUSTED) ---
  const CONSTANT_SPEED = 3.0; // Slightly faster to clear spawn area
  const MIN_VEHICLE_SPACING = 45; // Reduced spacing requirement to allow tighter groups

  const addVehicle = (lane) => {
    const laneConfig = {
      leftLane1: { y: 150, color: '#3b82f6', direction: -1 }, 
      leftLane2: { y: 210, color: '#60a5fa', direction: -1 }, 
      rightLane1: { y: 390, color: '#ef4444', direction: 1 }, 
      rightLane2: { y: 450, color: '#f87171', direction: 1 } 
    };

    const config = laneConfig[lane];
    const startX = config.direction === 1 ? -60 : 1060; 
    
    // Safety check: is another car too close?
    const tooClose = vehiclesRef.current.some(v => 
      v.lane === lane && 
      Math.abs(v.x - startX) < MIN_VEHICLE_SPACING
    );
    
    if (tooClose) return; // This was blocking your cars!

    const newId = vehicleIdCounter.current++;
    const newVehicle = {
      id: newId, lane, x: startX, y: config.y, speed: CONSTANT_SPEED,
      direction: config.direction, color: config.color, width: 44, height: 24, type: 'car'
    };

    vehiclesRef.current.push(newVehicle);
    
    if (mode === 'simulation') {
      setSimVehicles(prev => ({ ...prev, [lane]: prev[lane] + 1 }));
    }
  };

  // --- LIVE MODE ANIMATION TRIGGER (FIXED TIMING) ---
  useEffect(() => {
    if (mode === 'live') {
      const currentLeftTotal = sensorData.leftLane1Count + sensorData.leftLane2Count;
      const currentRightTotal = sensorData.rightLane1Count + sensorData.rightLane2Count;

      if (isFirstLiveLoad.current) {
        prevLiveCounts.current = { left: currentLeftTotal, right: currentRightTotal };
        isFirstLiveLoad.current = false;
      } else {
        const deltaLeft = currentLeftTotal - prevLiveCounts.current.left;
        const deltaRight = currentRightTotal - prevLiveCounts.current.right;

        // FIXED: Increased delay from 200ms to 600ms to ensure spawn area is clear
        if (deltaLeft > 0 && deltaLeft < 50) { 
          for (let i = 0; i < deltaLeft; i++) {
            const randomLane = Math.random() > 0.5 ? 'leftLane1' : 'leftLane2';
            setTimeout(() => addVehicle(randomLane), i * 600); 
          }
        }

        if (deltaRight > 0 && deltaRight < 50) {
          for (let i = 0; i < deltaRight; i++) {
            const randomLane = Math.random() > 0.5 ? 'rightLane1' : 'rightLane2';
            setTimeout(() => addVehicle(randomLane), i * 600);
          }
        }

        prevLiveCounts.current = { left: currentLeftTotal, right: currentRightTotal };
      }
    } else {
        isFirstLiveLoad.current = true;
    }
  }, [sensorData, mode]);


  // --- DECISION LOGIC ---
  const determineSystemFunction = (data) => {
    const leftTotal = data.leftLane1Count + data.leftLane2Count;
    const rightTotal = data.rightLane1Count + data.rightLane2Count;
    const emergencyThreshold = 80;

    if (data.leftSoundLevel >= emergencyThreshold) return { function: 4, confidence: 0.95, side: 'left' };
    if (data.rightSoundLevel >= emergencyThreshold) return { function: 4, confidence: 0.95, side: 'right' };

    const highCongestion = 8;
    const mediumCongestion = 5;

    if (leftTotal >= highCongestion && rightTotal >= highCongestion) return { function: 1, confidence: 0.88, side: null };
    if (leftTotal >= mediumCongestion && leftTotal > rightTotal + 2) return { function: 2, confidence: 0.85, side: null };
    if (rightTotal >= mediumCongestion && rightTotal > leftTotal + 2) return { function: 3, confidence: 0.85, side: null };

    return { function: 0, confidence: 0.92, side: null };
  };

  useEffect(() => {
    if (mode === 'simulation') {
        const data = {
            leftLane1Count: simVehicles.leftLane1,
            leftLane2Count: simVehicles.leftLane2,
            rightLane1Count: simVehicles.rightLane1,
            rightLane2Count: simVehicles.rightLane2,
            leftSoundLevel: sensorData.leftSoundLevel,
            rightSoundLevel: sensorData.rightSoundLevel
        };
        const decision = determineSystemFunction(data);
        if (systemFunction !== 4) {
            setSystemFunction(decision.function);
            setConfidence(decision.confidence);
            setEmergencySide(decision.side);
            setBarrierStates(getBarrierStates(decision.function, decision.side));
        }
        updateCharts(data);
    } else {
        updateCharts(sensorData);
    }
  }, [sensorData, simVehicles, mode, systemFunction]);

  const updateCharts = (data) => {
    const timestamp = Date.now();
    setAnalyticsData(prev => ({
      congestionResponse: [...prev.congestionResponse.slice(-20), {
        congestion: data.leftLane1Count + data.leftLane2Count + data.rightLane1Count + data.rightLane2Count,
        responseTime: Math.random() * 2 + 0.5,
        time: timestamp
      }],
      soundVehicle: [...prev.soundVehicle.slice(-20), {
        sound: Math.max(data.leftSoundLevel, data.rightSoundLevel),
        vehicles: data.leftLane1Count + data.leftLane2Count + data.rightLane1Count + data.rightLane2Count,
        time: timestamp
      }],
      trafficPattern: [...prev.trafficPattern.slice(-30), {
        time: new Date(timestamp).toLocaleTimeString(),
        left: data.leftLane1Count + data.leftLane2Count,
        right: data.rightLane1Count + data.rightLane2Count
      }]
    }));
  };

  const resetSimulation = () => {
    setSimVehicles({ leftLane1: 0, leftLane2: 0, rightLane1: 0, rightLane2: 0 });
    vehiclesRef.current = [];
    setEmergencyVehicle(null);
    setSensorData({ leftLane1Count: 0, leftLane2Count: 0, rightLane1Count: 0, rightLane2Count: 0, leftSoundLevel: 45, rightSoundLevel: 45 });
    setSystemFunction(0);
    setEmergencySide(null);
    setBarrierStates(getBarrierStates(0));
  };

  const triggerEmergency = (side) => {
    if (mode === 'live') {
        update(ref(db, 'state/system'), { mode: 'EMERGENCY', lastUpdate: Date.now() / 1000 });
        update(ref(db, 'state/emergency'), { active: true, side: side === 'left' ? 'LEFT' : 'RIGHT' });
        alert(`Emergency Trigger Sent to Firebase: ${side.toUpperCase()}`);
    } else {
        setSystemFunction(4);
        setEmergencySide(side);
        setBarrierStates(getBarrierStates(4, side));
        setSensorData(prev => ({ ...prev, [`${side}SoundLevel`]: 85 }));
        setConfidence(0.95);

        const startX = side === 'left' ? 1060 : -60;
        const direction = side === 'left' ? -1 : 1;
        const startY = side === 'left' ? 210 : 420;
        const targetY = side === 'left' ? 270 : 330;

        setEmergencyVehicle({
            x: startX, y: startY, targetY: targetY, speed: 3.5, direction: direction,
            side: side, width: 50, height: 28, sirenState: 0, phase: 'approaching', barrierX: 500, type: 'ambulance'
        });

        setTimeout(() => {
            setEmergencyVehicle(null);
            setSensorData(prev => ({ ...prev, [`${side}SoundLevel`]: 45 }));
            setSystemFunction(0);
            setEmergencySide(null);
            setBarrierStates(getBarrierStates(0));
        }, 10000);
    }
  };

  const drawCar = (ctx, x, y, width, height, color, direction, isAmbulance = false) => {
    ctx.save();
    ctx.translate(x, y);
    if (direction === -1) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, height/2 + 2, width/2 + 2, height/2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = isAmbulance ? '#ffffff' : color;
    ctx.beginPath();
    ctx.roundRect(-width/2, -height/2, width, height, 6);
    ctx.fill();

    // Roof
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; 
    const cabinWidth = width * 0.6;
    const cabinHeight = height * 0.7;
    ctx.beginPath();
    ctx.roundRect(-cabinWidth/2 + 2, -cabinHeight/2, cabinWidth, cabinHeight, 4);
    ctx.fill();

    // Lights
    ctx.fillStyle = '#fef08a'; // Headlights
    ctx.beginPath();
    ctx.arc(width/2 - 2, -height/3, 3, 0, Math.PI * 2);
    ctx.arc(width/2 - 2, height/3, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ef4444'; // Taillights
    ctx.beginPath();
    ctx.rect(-width/2, -height/3 - 1, 2, 4);
    ctx.rect(-width/2, height/3 - 2, 2, 4);
    ctx.fill();

    if (isAmbulance) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-4, -8, 8, 16);
      ctx.fillRect(-8, -4, 16, 8);
      const flash = Math.floor(Date.now() / 200) % 2 === 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  };

  // --- CANVAS ANIMATION ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const roadY = 120;
    const laneHeight = 60;
    const corridorStart = 240;
    const corridorHeight = 120;

    let lastCleanupTime = Date.now();

    const animate = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Roads
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, roadY, width, laneHeight * 2);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([20, 15]);
      ctx.beginPath(); ctx.moveTo(0, roadY + laneHeight); ctx.lineTo(width, roadY + laneHeight); ctx.stroke();
      
      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, corridorStart, width, corridorHeight);
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, corridorStart + corridorHeight, width, laneHeight * 2);
      ctx.beginPath(); ctx.moveTo(0, corridorStart + corridorHeight + laneHeight); ctx.lineTo(width, corridorStart + corridorHeight + laneHeight); ctx.stroke();
      ctx.setLineDash([]); 

      // Barriers
      let leftBarrier = barrierStates.left;
      let rightBarrier = barrierStates.right;

      if (emergencyRef.current) {
        const ex = emergencyRef.current.x;
        const cx = width / 2;
        if (emergencyRef.current.side === 'left') {
           if (ex > cx - 150 && ex < cx + 150) leftBarrier = 'lowered';
           else if (ex < cx - 150) leftBarrier = 'raised';
        } else {
           if (ex > cx - 150 && ex < cx + 150) rightBarrier = 'lowered';
           else if (ex > cx + 150) rightBarrier = 'raised';
        }
      }

      const drawBarrier = (y, state) => {
          if(state === 'raised') {
            ctx.fillStyle = '#dc2626'; ctx.fillRect(0, y, width, 10);
            ctx.fillStyle = '#fef3c7'; for (let x = 0; x < width; x += 40) ctx.fillRect(x, y, 20, 10);
          } else {
            ctx.fillStyle = '#22c55e'; ctx.fillRect(0, y+2, width, 6); 
          }
      };
      drawBarrier(roadY + laneHeight * 2 - 5, leftBarrier);
      drawBarrier(corridorStart + corridorHeight / 2 - 5, barrierStates.middle);
      drawBarrier(corridorStart + corridorHeight - 5, rightBarrier);

      // Labels
      ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 16px Arial';
      ctx.fillText('LEFT ROAD (L1) ←', 20, roadY + 35); 
      ctx.fillText('LEFT ROAD (L2) ←', 20, roadY + 95);
      ctx.fillStyle = '#34d399'; ctx.fillText('☘ GREEN CORRIDOR', width/2 - 70, corridorStart + 60);
      ctx.fillStyle = '#94a3b8'; 
      ctx.fillText('→ RIGHT ROAD (R1)', width - 180, corridorStart + corridorHeight + 35); 
      ctx.fillText('→ RIGHT ROAD (R2)', width - 180, corridorStart + corridorHeight + 95);

      // Vehicles
      if (vehiclesRef.current.length > 0) {
          vehiclesRef.current = vehiclesRef.current.map(vehicle => {
            const newX = vehicle.x + (vehicle.speed * vehicle.direction);
            drawCar(ctx, newX, vehicle.y, vehicle.width, vehicle.height, vehicle.color, vehicle.direction, false);
            return { ...vehicle, x: newX };
          });
      }

      // Cleanup
      const now = Date.now();
      if (now - lastCleanupTime > 1000) {
        lastCleanupTime = now;
        const validVehicles = [];
        const laneCounts = { leftLane1: 0, leftLane2: 0, rightLane1: 0, rightLane2: 0 };
        vehiclesRef.current.forEach(v => {
          if (v.x > -150 && v.x < width + 150) {
            validVehicles.push(v);
            laneCounts[v.lane]++;
          }
        });
        vehiclesRef.current = validVehicles;
        if(mode === 'simulation') setSimVehicles(laneCounts);
      }

      // Emergency Vehicle
      if (emergencyRef.current) {
        let amb = emergencyRef.current;
        let newX = amb.x + (amb.speed * amb.direction);
        let newY = amb.y;
        const cx = width / 2;
        if (Math.abs(newX - cx) < 120 && amb.phase === 'approaching') {
          newY = amb.y + (amb.targetY - amb.y) * ((120 - Math.abs(newX - cx)) / 120);
          if (Math.abs(newY - amb.targetY) < 5) amb.phase = 'inside';
        }
        emergencyRef.current = { ...amb, x: newX, y: newY };
        drawCar(ctx, newX, newY, amb.width, amb.height, '#fff', amb.direction, true);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [barrierStates, mode]);

  const functionDescriptions = {
    0: 'Normal Operation - All barriers raised, regular traffic flow',
    1: 'Both Roads Congested - Left and Right barriers lowered, Middle raised',
    2: 'Left Road Priority - Left and Middle barriers lowered for left traffic',
    3: 'Right Road Priority - Right and Middle barriers lowered for right traffic',
    4: `Emergency Override - ${emergencySide ? `${emergencySide.toUpperCase()} barrier lowered` : 'Awaiting emergency direction'}`
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Intelligent Traffic Management System
        </h1>
        <p className="text-gray-400">Dynamic Green Corridor Control Dashboard</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {firebaseConnected ? <Wifi className="text-green-400" size={20} /> : <WifiOff className="text-red-400" size={20} />}
            <span className="text-sm">Firebase: {firebaseConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className={esp32Connected ? 'text-green-400' : 'text-red-400'} size={20} />
            <span className="text-sm">ESP32: {esp32Connected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm">Mode:</span>
          <button onClick={() => setMode(mode === 'live' ? 'simulation' : 'live')} className={`px-4 py-2 rounded-lg font-semibold transition-all ${mode === 'live' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {mode === 'live' ? '🔴 LIVE MODE' : '🎮 SIMULATION MODE'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Activity className="text-cyan-400" /> AI Decision Engine</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-400 mb-2">Active System Function</div>
              <div className="text-3xl font-bold text-cyan-400 mb-2">Function {systemFunction}</div>
              <div className="text-xs text-gray-300 leading-relaxed">{functionDescriptions[systemFunction]}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Confidence Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-700 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-cyan-500 h-3 rounded-full transition-all duration-500" style={{ width: `${confidence * 100}%` }} />
                </div>
                <span className="text-sm font-bold">{(confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CarFront className="text-yellow-400" /> Real-Time Sensor Data</h2>
          <div className="space-y-4">
            <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-400 font-bold text-sm">LEFT ROAD</span>
                    <span className="text-xs text-gray-400">ID: SENS-001</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs">Traffic Density</span>
                        <span className="font-bold text-lg">{sensorData.leftLane1Count + sensorData.leftLane2Count} <span className="text-xs font-normal">cars</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs">Audio Level</span>
                        <div className="flex items-center gap-1">
                            <Volume2 size={14} className={sensorData.leftSoundLevel > 70 ? "text-red-400" : "text-green-400"} />
                            <span className={`font-bold text-lg ${sensorData.leftSoundLevel > 70 ? "text-red-400" : "text-green-400"}`}>{sensorData.leftSoundLevel} <span className="text-xs font-normal">dB</span></span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-red-400 font-bold text-sm">RIGHT ROAD</span>
                    <span className="text-xs text-gray-400">ID: SENS-002</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs">Traffic Density</span>
                        <span className="font-bold text-lg">{sensorData.rightLane1Count + sensorData.rightLane2Count} <span className="text-xs font-normal">cars</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs">Audio Level</span>
                        <div className="flex items-center gap-1">
                            <Volume2 size={14} className={sensorData.rightSoundLevel > 70 ? "text-red-400" : "text-green-400"} />
                            <span className={`font-bold text-lg ${sensorData.rightSoundLevel > 70 ? "text-red-400" : "text-green-400"}`}>{sensorData.rightSoundLevel} <span className="text-xs font-normal">dB</span></span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Emergency Override</h2>
          <div className="space-y-3">
            <button onClick={() => triggerEmergency('left')} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
              <AlertTriangle size={20} /> 🚨 Emergency from LEFT
            </button>
            <button onClick={() => triggerEmergency('right')} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
              <AlertTriangle size={20} /> 🚨 Emergency from RIGHT
            </button>
          </div>
          {mode === 'simulation' && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Simulation Controls</h3>
                <button onClick={resetSimulation} className="bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded-lg text-sm flex items-center gap-1"><RotateCcw size={16} /> Reset</button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="col-span-1 space-y-2">
                      <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Left Road</div>
                      <button onClick={() => addVehicle('leftLane1')} className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded text-xs flex justify-between items-center"><span>Lane 1</span> <span className="bg-blue-800 px-2 rounded-full">{simVehicles.leftLane1}</span> +</button>
                      <button onClick={() => addVehicle('leftLane2')} className="w-full bg-blue-500 hover:bg-blue-600 p-2 rounded text-xs flex justify-between items-center"><span>Lane 2</span> <span className="bg-blue-800 px-2 rounded-full">{simVehicles.leftLane2}</span> +</button>
                  </div>
                  <div className="col-span-1 space-y-2">
                      <div className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Right Road</div>
                       <button onClick={() => addVehicle('rightLane1')} className="w-full bg-red-600 hover:bg-red-700 p-2 rounded text-xs flex justify-between items-center"><span>Lane 1</span> <span className="bg-red-900 px-2 rounded-full">{simVehicles.rightLane1}</span> +</button>
                      <button onClick={() => addVehicle('rightLane2')} className="w-full bg-red-500 hover:bg-red-600 p-2 rounded text-xs flex justify-between items-center"><span>Lane 2</span> <span className="bg-red-900 px-2 rounded-full">{simVehicles.rightLane2}</span> +</button>
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Real-Time Road Visualization</h2>
        <canvas ref={canvasRef} width={1000} height={550} className="w-full bg-gray-900 rounded-lg shadow-inner" />
        <div className="mt-4 flex justify-around text-sm">
           <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-600 rounded"></div><span>Barrier Raised (Closed)</span></div>
           <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-600 rounded"></div><span>Barrier Lowered (Open)</span></div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BarChart3 className="text-purple-400" /> Analytics Dashboard</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Congestion vs Response</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="congestion" stroke="#9ca3af" label={{ value: 'Vehicles', position: 'bottom', fill: '#9ca3af' }} />
                <YAxis dataKey="responseTime" stroke="#9ca3af" label={{ value: 'Time (s)', angle: -90, position: 'left', fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                <Scatter data={analyticsData.congestionResponse} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Sound vs Count</h3>
            <ResponsiveContainer width="100%" height={200}>
               <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="vehicles" stroke="#9ca3af" label={{ value: 'Vehicles', position: 'bottom', fill: '#9ca3af' }} />
                <YAxis dataKey="sound" stroke="#9ca3af" label={{ value: 'dB', angle: -90, position: 'left', fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label="Emergency" />
                <Scatter data={analyticsData.soundVehicle} fill="#10b981" />
               </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Traffic Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analyticsData.trafficPattern}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                <Legend />
                <Line type="monotone" dataKey="left" stroke="#60a5fa" strokeWidth={2} dot={false} name="Left Road" />
                <Line type="monotone" dataKey="right" stroke="#f87171" strokeWidth={2} dot={false} name="Right Road" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficManagementDashboard;
