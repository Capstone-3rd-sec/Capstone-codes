import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Activity,
  Car,
  Volume2,
  BarChart3,
  Zap,
  Shield,
} from "lucide-react";

const TrafficManagementSystem = () => {
  const [vehicles, setVehicles] = useState([]);
  const [barriers, setBarriers] = useState({
    left: "raised",
    middle: "raised",
    right: "raised",
  });

  const [congestionLevels, setCongestionLevels] = useState({
    leftRoad: 0,
    rightRoad: 0,
  });

  const [emergencyDetection, setEmergencyDetection] = useState({
    active: false,
    direction: null,
    soundLevel: 0,
  });

  const [sensorData, setSensorData] = useState({
    leftLane1Count: 0,
    leftLane2Count: 0,
    rightLane1Count: 0,
    rightLane2Count: 0,
    emergencyLaneCount: 0,
    leftSoundLevel: 0,
    rightSoundLevel: 0,
    avgSpeedLeft: 0,
    avgSpeedRight: 0,
  });

  const [activeFunction, setActiveFunction] = useState({
    number: 0,
    name: "Normal Operation",
    description: "No congestion detected. All barriers raised.",
    confidence: 0.95,
  });

  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    initializeVehicles();
    startAnimation();
    startDataSimulation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    determineActiveFunction();
  }, [congestionLevels, emergencyDetection]);

  const initializeVehicles = () => {
    const initialVehicles = [];
    for (let i = 0; i < 8; i++) {
      initialVehicles.push(createVehicle(i, Math.random() < 0.5 ? 1 : 2));
    }
    for (let i = 8; i < 16; i++) {
      initialVehicles.push(createVehicle(i, Math.random() < 0.5 ? 4 : 5));
    }
    setVehicles(initialVehicles);
  };

  const createVehicle = (id, lane) => ({
    id,
    x: Math.random() * 800,
    lane,
    speed: 2 + Math.random() * 2,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
    width: 40,
    height: 20,
    isEmergency: false,
  });

  const determineActiveFunction = () => {
    const leftCongested = congestionLevels.leftRoad > 0.7;
    const rightCongested = congestionLevels.rightRoad > 0.7;

    if (emergencyDetection.active) {
      const direction = emergencyDetection.direction;
      setBarriers({
        left: direction === "left" ? "lowered" : "raised",
        middle: "raised",
        right: direction === "right" ? "lowered" : "raised",
      });
      setActiveFunction({
        number: 4,
        name: "Emergency Override",
        description: `Emergency vehicle detected from ${direction} side. ${
          direction.charAt(0).toUpperCase() + direction.slice(1)
        } barrier opened for emergency access.`,
        confidence: 0.99,
      });
      return;
    }

    if (leftCongested && rightCongested) {
      setBarriers({
        left: "lowered", // Open left barrier
        middle: "raised", // Close middle barrier
        right: "lowered", // Open right barrier
      });
      setActiveFunction({
        number: 1,
        name: "Both Roads Congested",
        description:
          "Traffic jam detected on both roads. Middle barrier opened - emergency lane accessible from both sides.",
        confidence: 0.92,
      });
      return;
    }

    if (
      congestionLevels.leftRoad > congestionLevels.rightRoad &&
      congestionLevels.leftRoad > 0.5
    ) {
      setBarriers({
        left: "lowered",
        middle: "raised",
        right: "raised",
      });
      setActiveFunction({
        number: 2,
        name: "Left Road Priority",
        description:
          "Higher congestion on left road. Left barrier opened for emergency lane access.",
        confidence: 0.87,
      });
      return;
    }

    if (
      congestionLevels.rightRoad > congestionLevels.leftRoad &&
      congestionLevels.rightRoad > 0.5
    ) {
      setBarriers({
        left: "raised",
        middle: "raised",
        right: "lowered",
      });
      setActiveFunction({
        number: 3,
        name: "Right Road Priority",
        description:
          "Higher congestion on right road. Right barrier opened for emergency lane access.",
        confidence: 0.87,
      });
      return;
    }

    setBarriers({
      left: "raised",
      middle: "raised",
      right: "raised",
    });
    setActiveFunction({
      number: 0,
      name: "Normal Operation",
      description: "Traffic flowing normally. All barriers closed.",
      confidence: 0.95,
    });
  };

  const startDataSimulation = () => {
    setInterval(() => {
      const leftCongestion = Math.random();
      const rightCongestion = Math.random();

      setCongestionLevels({
        leftRoad: leftCongestion,
        rightRoad: rightCongestion,
      });

      setSensorData({
        leftLane1Count: Math.floor(15 + leftCongestion * 25),
        leftLane2Count: Math.floor(12 + leftCongestion * 28),
        rightLane1Count: Math.floor(14 + rightCongestion * 26),
        rightLane2Count: Math.floor(13 + rightCongestion * 27),
        emergencyLaneCount: emergencyDetection.active
          ? Math.floor(Math.random() * 3)
          : 0,
        leftSoundLevel:
          emergencyDetection.direction === "left"
            ? 85 + Math.random() * 15
            : 40 + Math.random() * 20,
        rightSoundLevel:
          emergencyDetection.direction === "right"
            ? 85 + Math.random() * 15
            : 40 + Math.random() * 20,
        avgSpeedLeft:
          leftCongestion > 0.7
            ? 20 + Math.random() * 15
            : 50 + Math.random() * 20,
        avgSpeedRight:
          rightCongestion > 0.7
            ? 20 + Math.random() * 15
            : 50 + Math.random() * 20,
      });
    }, 2000);
  };

  const startAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, width, height);

      const laneWidth = height / 6;

      // Draw LEFT ROAD
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(0, 0, width, laneWidth * 2);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([15, 10]);
      ctx.beginPath();
      ctx.moveTo(0, laneWidth);
      ctx.lineTo(width, laneWidth);
      ctx.stroke();

      // Draw GREEN EMERGENCY LANE
      ctx.fillStyle = emergencyDetection.active
        ? "rgba(0, 255, 0, 0.2)"
        : "rgba(0, 255, 0, 0.08)";
      ctx.fillRect(0, laneWidth * 2, width, laneWidth * 2);

      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, laneWidth * 2);
      ctx.lineTo(width, laneWidth * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, laneWidth * 4);
      ctx.lineTo(width, laneWidth * 4);
      ctx.stroke();

      // Draw RIGHT ROAD
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(0, laneWidth * 4, width, laneWidth * 2);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([15, 10]);
      ctx.beginPath();
      ctx.moveTo(0, laneWidth * 5);
      ctx.lineTo(width, laneWidth * 5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw HORIZONTAL BARRIERS (only if raised/closed)
      // Left Barrier - at boundary between left road and emergency lane
      drawHorizontalBarrier(
        ctx,
        0, // x position
        laneWidth * 2, // y position (between left road and green lane)
        width, // full canvas width
        "LEFT",
        barriers.left === "raised" // Pass barrier state
      );

      // Middle Barrier - center of emergency lane
      drawHorizontalBarrier(
        ctx,
        0, // x position
        laneWidth * 3, // y position (middle of green lane)
        width, // full canvas width
        "MID",
        barriers.middle === "raised" // Pass barrier state
      );

      // Right Barrier - at boundary between emergency lane and right road
      drawHorizontalBarrier(
        ctx,
        0, // x position
        laneWidth * 4, // y position (between green lane and right road)
        width, // full canvas width
        "RIGHT",
        barriers.right === "raised" // Pass barrier state
      );

      // Update and draw vehicles
      setVehicles((prevVehicles) => {
        return prevVehicles.map((vehicle) => {
          let newX = vehicle.x;
          let newSpeed = vehicle.speed;

          if (vehicle.lane <= 2 && congestionLevels.leftRoad > 0.7) {
            newSpeed = vehicle.speed * 0.3;
          } else if (vehicle.lane >= 4 && congestionLevels.rightRoad > 0.7) {
            newSpeed = vehicle.speed * 0.3;
          }

          if (vehicle.isEmergency) {
            newSpeed = vehicle.speed * 2.5;
          }

          newX += newSpeed;

          if (newX > width + 50) {
            newX = -50;
          }

          let laneY;
          if (vehicle.lane === 1) laneY = laneWidth * 0.5;
          else if (vehicle.lane === 2) laneY = laneWidth * 1.5;
          else if (vehicle.lane === 3) laneY = laneWidth * 3;
          else if (vehicle.lane === 4) laneY = laneWidth * 4.5;
          else laneY = laneWidth * 5.5;

          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(newX + 2, laneY - 8, vehicle.width, vehicle.height);

          ctx.fillStyle = vehicle.isEmergency ? "#ff0000" : vehicle.color;
          ctx.fillRect(newX, laneY - 10, vehicle.width, vehicle.height);

          ctx.fillStyle = "rgba(100, 150, 200, 0.6)";
          ctx.fillRect(newX + 8, laneY - 7, 10, 14);
          ctx.fillRect(newX + 22, laneY - 7, 10, 14);

          if (vehicle.isEmergency) {
            const lightColor = Date.now() % 600 < 300 ? "#ff0000" : "#0000ff";
            ctx.fillStyle = lightColor;
            ctx.beginPath();
            ctx.arc(newX + 5, laneY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(newX + vehicle.width - 5, laneY, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          return { ...vehicle, x: newX, speed: newSpeed };
        });
      });

      // Draw road labels
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("LEFT ROAD", 10, laneWidth * 0.3);
      ctx.fillText("Lane 1", 10, laneWidth * 0.7);
      ctx.fillText("Lane 2", 10, laneWidth * 1.7);

      ctx.fillStyle = "#00ff00";
      ctx.font = "bold 16px Arial";

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("RIGHT ROAD", 10, laneWidth * 4.3);
      ctx.fillText("Lane 1", 10, laneWidth * 4.7);
      ctx.fillText("Lane 2", 10, laneWidth * 5.7);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const drawHorizontalBarrier = (ctx, x, y, width, label) => {
    // Make barrier cover 80% of the road width (much longer)
    const barrierWidth = width * 0.8;
    const barrierX = width * 0.1; // Center the barrier

    // Horizontal barrier arm - thicker and longer
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(barrierX, y - 8, barrierWidth, 16);

    // Diagonal stripes - more stripes for longer barrier
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < barrierWidth / 15; i++) {
      ctx.fillRect(barrierX + i * 15, y - 6, 6, 12);
    }

    // Support posts at ends - larger posts
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(barrierX - 8, y - 20, 16, 40);
    ctx.fillRect(barrierX + barrierWidth - 8, y - 20, 16, 40);

    // Label - positioned above barrier
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(label, barrierX + barrierWidth / 2 - 15, y - 25);

    // Status lights at posts - larger lights
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(barrierX, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(barrierX + barrierWidth, y, 8, 0, Math.PI * 2);
    ctx.fill();
  };

  const simulateEmergency = (direction) => {
    setEmergencyDetection({
      active: true,
      direction,
      soundLevel: 95,
    });

    const emergencyLane = 3;

    setVehicles((prev) => [
      ...prev,
      {
        id: Date.now(),
        x: direction === "left" ? -50 : 950,
        lane: emergencyLane,
        speed: direction === "left" ? 5 : -5,
        color: "#ff0000",
        width: 50,
        height: 24,
        isEmergency: true,
      },
    ]);

    setTimeout(() => {
      setEmergencyDetection({
        active: false,
        direction: null,
        soundLevel: 0,
      });
    }, 15000);
  };

  const simulateCongestion = (side) => {
    if (side === "left") {
      setCongestionLevels({ leftRoad: 0.85, rightRoad: 0.3 });
    } else if (side === "right") {
      setCongestionLevels({ leftRoad: 0.3, rightRoad: 0.85 });
    } else if (side === "both") {
      setCongestionLevels({ leftRoad: 0.85, rightRoad: 0.85 });
    }
  };

  const getCongestionColor = (level) => {
    if (level > 0.7) return "bg-red-500";
    if (level > 0.4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getFunctionColor = (num) => {
    if (num === 4) return "text-red-400";
    if (num === 0) return "text-green-400";
    return "text-yellow-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
            Intelligent Traffic Management System
          </h1>
          <p className="text-gray-300 text-lg">
            AI-Powered Emergency Lane with 3-Barrier Control System
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-gray-800 rounded-lg shadow-2xl p-4">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <Activity className="mr-2" /> Live Traffic Flow
            </h2>
            <canvas
              ref={canvasRef}
              width={900}
              height={480}
              className="w-full h-auto bg-gray-900 rounded border-2 border-gray-700"
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-700 p-3 rounded">
                <div className="text-sm font-semibold mb-2">
                  Left Road Congestion
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-600 rounded h-4">
                    <div
                      className={`h-full rounded transition-all ${getCongestionColor(
                        congestionLevels.leftRoad
                      )}`}
                      style={{
                        width: `${congestionLevels.leftRoad * 100}%`,
                      }}></div>
                  </div>
                  <span className="text-sm font-bold">
                    {(congestionLevels.leftRoad * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="bg-gray-700 p-3 rounded">
                <div className="text-sm font-semibold mb-2">
                  Right Road Congestion
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-600 rounded h-4">
                    <div
                      className={`h-full rounded transition-all ${getCongestionColor(
                        congestionLevels.rightRoad
                      )}`}
                      style={{
                        width: `${congestionLevels.rightRoad * 100}%`,
                      }}></div>
                  </div>
                  <span className="text-sm font-bold">
                    {(congestionLevels.rightRoad * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {["left", "middle", "right"].map((pos) => {
                const isVisible =
                  pos === "middle"
                    ? barriers[pos] === "raised" &&
                      (activeFunction.number === 0 ||
                        activeFunction.number === 1)
                    : barriers[pos] === "raised";

                return (
                  <div
                    key={pos}
                    className={`p-2 rounded text-center ${
                      isVisible ? "bg-red-600" : "bg-green-600"
                    }`}>
                    <div className="text-xs font-bold uppercase">
                      {pos} Barrier
                    </div>
                    <div className="text-sm">
                      {isVisible ? "🚧 CLOSED" : "✅ OPEN"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg shadow-2xl p-4">
              <h2 className="text-xl font-bold mb-3 flex items-center">
                <Zap className="mr-2" /> Active Function
              </h2>
              <div className="space-y-2">
                <div
                  className={`text-3xl font-bold ${getFunctionColor(
                    activeFunction.number
                  )}`}>
                  Function {activeFunction.number}
                </div>
                <div className="text-lg font-semibold">
                  {activeFunction.name}
                </div>
                <div className="text-sm text-gray-300">
                  {activeFunction.description}
                </div>
                <div className="text-xs text-gray-400">
                  Confidence:{" "}
                  <span className="font-bold text-white">
                    {(activeFunction.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-900 to-red-700 rounded-lg shadow-2xl p-4">
              <h2 className="text-xl font-bold mb-3 flex items-center">
                <AlertCircle className="mr-2" /> Emergency Control
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => simulateEmergency("left")}
                  disabled={emergencyDetection.active}
                  className={`w-full py-2 px-3 rounded font-bold transition ${
                    emergencyDetection.active &&
                    emergencyDetection.direction === "left"
                      ? "bg-red-500"
                      : "bg-red-600 hover:bg-red-500"
                  } ${
                    emergencyDetection.active
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}>
                  🚨 Emergency from LEFT
                </button>
                <button
                  onClick={() => simulateEmergency("right")}
                  disabled={emergencyDetection.active}
                  className={`w-full py-2 px-3 rounded font-bold transition ${
                    emergencyDetection.active &&
                    emergencyDetection.direction === "right"
                      ? "bg-red-500"
                      : "bg-red-600 hover:bg-red-500"
                  } ${
                    emergencyDetection.active
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}>
                  🚨 Emergency from RIGHT
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-2xl p-4">
              <h2 className="text-lg font-bold mb-3 flex items-center">
                <BarChart3 className="mr-2" /> Test Scenarios
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => simulateCongestion("left")}
                  className="w-full py-2 px-3 rounded bg-yellow-600 hover:bg-yellow-500 font-semibold text-sm">
                  Congest Left Road
                </button>
                <button
                  onClick={() => simulateCongestion("right")}
                  className="w-full py-2 px-3 rounded bg-yellow-600 hover:bg-yellow-500 font-semibold text-sm">
                  Congest Right Road
                </button>
                <button
                  onClick={() => simulateCongestion("both")}
                  className="w-full py-2 px-3 rounded bg-orange-600 hover:bg-orange-500 font-semibold text-sm">
                  Congest Both Roads
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Car className="w-4 h-4 mr-2 text-blue-400" />
              <div className="text-xs text-gray-400">Left L1</div>
            </div>
            <div className="text-xl font-bold">{sensorData.leftLane1Count}</div>
            <div className="text-xs text-gray-500">vehicles</div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Car className="w-4 h-4 mr-2 text-blue-400" />
              <div className="text-xs text-gray-400">Left L2</div>
            </div>
            <div className="text-xl font-bold">{sensorData.leftLane2Count}</div>
            <div className="text-xs text-gray-500">vehicles</div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Car className="w-4 h-4 mr-2 text-purple-400" />
              <div className="text-xs text-gray-400">Right L1</div>
            </div>
            <div className="text-xl font-bold">
              {sensorData.rightLane1Count}
            </div>
            <div className="text-xs text-gray-500">vehicles</div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Car className="w-4 h-4 mr-2 text-purple-400" />
              <div className="text-xs text-gray-400">Right L2</div>
            </div>
            <div className="text-xl font-bold">
              {sensorData.rightLane2Count}
            </div>
            <div className="text-xs text-gray-500">vehicles</div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Volume2 className="w-4 h-4 mr-2 text-yellow-400" />
              <div className="text-xs text-gray-400">Sound L/R</div>
            </div>
            <div className="text-lg font-bold">
              {sensorData.leftSoundLevel.toFixed(0)}/
              {sensorData.rightSoundLevel.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">dB</div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-xl p-3">
            <div className="flex items-center mb-1">
              <Shield className="w-4 h-4 mr-2 text-green-400" />
              <div className="text-xs text-gray-400">Emergency</div>
            </div>
            <div className="text-xl font-bold text-green-400">
              {sensorData.emergencyLaneCount}
            </div>
            <div className="text-xs text-gray-500">vehicles</div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-2">System Functions:</h3>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-300">
            <div>
              <span className="font-semibold text-green-400">Function 0:</span>{" "}
              Normal operation → All barriers closed
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Function 1:</span>{" "}
              Both roads congested → Middle barrier opens
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Function 2:</span>{" "}
              Left road congested → Left barrier opens
            </div>
            <div>
              <span className="font-semibold text-yellow-400">Function 3:</span>{" "}
              Right road congested → Right barrier opens
            </div>
            <div className="md:col-span-2">
              <span className="font-semibold text-red-400">Function 4:</span>{" "}
              Emergency detected → Barrier from sound direction opens (overrides
              all)
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            🔗 Ready for Firebase & ESP32 Integration | Real-time Sensor Data |
            AI Decision Engine
          </p>
          <p className="mt-1">
            Capstone Project - Intelligent Traffic Management with Emergency
            Response
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrafficManagementSystem;
