/*
 * ========================================================================
 * GREEN-ROAD: FINAL CORRECTED LOGIC (MID OPEN BY DEFAULT)
 * ========================================================================
 */

#include <Arduino.h>
#include <ESP32Servo.h>
#include <WiFi.h> // for the Firebase connection  x 
#include <HTTPClient.h> // for the Firebase connection
#include <WiFiClientSecure.h> // for the Firebase connection
#include <deque>
#include "model.h" // the Ai model made by tensor flow 


// ======================= CONFIGURATION =======================
#define WIFI_SSID       "B535_2D62"      
#define WIFI_PASSWORD   "2BL2d3bMnA6" 
const char* DATABASE_URL = "https://final-cap-e14a9-default-rtdb.europe-west1.firebasedatabase.app/state.json";

#define SENSOR_DISTANCE_CM 300.0  
#define DECISION_INTERVAL_MS 10000 
#define MIN_CAR_THRESHOLD 3       
#define MIN_TRAVEL_TIME_MS 800    
#define GLOBAL_MARGIN 0.85         
#define LANE2_MARGIN 0.95          

const int POS_OPEN = 180;    
const int POS_CLOSED = 98;   

float SENSOR_THRESHOLDS[8] = { 11.50, 12.31, 11.50, 12.80, 10.13, 10.50, 11.59, 10.13 };

// ======================= PIN DEFINITIONS =======================
#define SERVO_LEFT_PIN  42   
#define SERVO_MID_PIN   41   
#define SERVO_RIGHT_PIN 40   

const int TRIG_PINS[8] = {4, 6, 8, 10, 12, 14, 16, 18};
const int ECHO_PINS[8] = {5, 7, 9, 11, 13, 15, 17, 21};

// ======================= VARIABLES =======================
Servo servoLeft, servoMid, servoRight;  
int currentPosLeft = POS_CLOSED;
int currentPosMid = POS_OPEN;   
int currentPosRight = POS_CLOSED;

unsigned long lastDecisionTime = 0;
float leftSpeedSum = 0, rightSpeedSum = 0;
int leftSpeedCount = 0, rightSpeedCount = 0;

struct Lane {
  int trigEntry, echoEntry, idxEntry;
  int trigExit, echoExit, idxExit;
  std::deque<unsigned long> entryTimestamps; 
  bool entryBlocked;  
  int intervalCount;  
  int entryHitCount; 
};

Lane lanes[4]; 

// ======================= FIREBASE FUNCTION =======================

void sendToFirebase(int lCars, float lAvg, int rCars, float rAvg) {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;

  String wL = (currentPosLeft == POS_OPEN) ? "UP" : "DOWN";
  String wM = (currentPosMid == POS_OPEN) ? "UP" : "DOWN";
  String wR = (currentPosRight == POS_OPEN) ? "UP" : "DOWN";

  String json = "{";
  json += "\"system\":{\"mode\":\"NORMAL\",\"condition\":0,\"lastUpdate\":" + String(millis()/1000) + "},";
  json += "\"traffic\":{";
  json += "  \"left\":{\"cars\":" + String(lCars) + ",\"avgSpeed\":" + String(lAvg) + "},";
  json += "  \"right\":{\"cars\":" + String(rCars) + ",\"avgSpeed\":" + String(rAvg) + "}";
  json += "},";
  json += "\"emergency\":{\"active\":false,\"side\":\"NONE\",\"dbLeft\":0,\"dbRight\":0},";
  json += "\"walls\":{\"left\":\"" + wL + "\",\"middle\":\"" + wM + "\",\"right\":\"" + wR + "\"}";
  json += "}";

  http.begin(client, DATABASE_URL);
  http.PATCH(json); 
  http.end();
}

// ======================= HELPER FUNCTIONS =======================

float getDistance(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long duration = pulseIn(echo, HIGH, 15000); 
  return (duration == 0) ? 999.0 : (duration * 0.0343 / 2.0);
}

void moveSmooth(Servo &servo, int &currentPos, int targetPos) {
  if (currentPos == targetPos) return;
  while (currentPos != targetPos) {
    currentPos += (currentPos < targetPos) ? 1 : -1;
    servo.write(currentPos);
    delay(20); 
  }
}

void processLane(int i) {
  unsigned long now = millis();
  float dEntry = getDistance(lanes[i].trigEntry, lanes[i].echoEntry);
  float margin = (lanes[i].idxEntry == 5) ? LANE2_MARGIN : GLOBAL_MARGIN;
  float tEntry = SENSOR_THRESHOLDS[lanes[i].idxEntry] * margin;

  if (dEntry > 2.0 && dEntry < tEntry) {
    lanes[i].entryHitCount++;
    if (lanes[i].entryHitCount >= 2 && !lanes[i].entryBlocked) {
      lanes[i].intervalCount++; 
      lanes[i].entryTimestamps.push_back(now); 
      lanes[i].entryBlocked = true; 
      Serial.printf(">>> [Lane %d] ENTRY. Total: %d\n", i, lanes[i].intervalCount);
    }
  } else {
    lanes[i].entryHitCount = 0;
    lanes[i].entryBlocked = false; 
  }

  if (!lanes[i].entryTimestamps.empty()) {
    unsigned long oldestCarTime = lanes[i].entryTimestamps.front();
    if (now - oldestCarTime > MIN_TRAVEL_TIME_MS) {
      float dExit = getDistance(lanes[i].trigExit, lanes[i].echoExit);
      float tExit = SENSOR_THRESHOLDS[lanes[i].idxExit] * GLOBAL_MARGIN;

      if (dExit > 2.0 && dExit < tExit) {
        lanes[i].entryTimestamps.pop_front(); 
        float timeSec = (now - oldestCarTime) / 1000.0;
        float speed = (SENSOR_DISTANCE_CM / 100.0 / timeSec) * 3.6;
        if (i < 2) { leftSpeedSum += speed; leftSpeedCount++; }
        else { rightSpeedSum += speed; rightSpeedCount++; }
        Serial.printf("<<< [Lane %d] EXIT. Speed: %.2f km/h\n", i, speed);
      }
    }
  }
}

// ======================= SETUP =======================

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  servoLeft.attach(SERVO_LEFT_PIN);
  servoMid.attach(SERVO_MID_PIN);
  servoRight.attach(SERVO_RIGHT_PIN);
  
  servoLeft.write(POS_CLOSED);
  servoRight.write(POS_CLOSED);
  servoMid.write(POS_OPEN); 

  lanes[0] = {TRIG_PINS[0], ECHO_PINS[0], 0, TRIG_PINS[1], ECHO_PINS[1], 1, {}, false, 0, 0};
  lanes[1] = {TRIG_PINS[2], ECHO_PINS[2], 2, TRIG_PINS[3], ECHO_PINS[3], 3, {}, false, 0, 0};
  lanes[2] = {TRIG_PINS[5], ECHO_PINS[5], 5, TRIG_PINS[4], ECHO_PINS[4], 4, {}, false, 0, 0}; 
  lanes[3] = {TRIG_PINS[7], ECHO_PINS[7], 7, TRIG_PINS[6], ECHO_PINS[6], 6, {}, false, 0, 0};

  for(int i=0; i<8; i++) { pinMode(TRIG_PINS[i], OUTPUT); pinMode(ECHO_PINS[i], INPUT); }
  Serial.println("System Initialized. Mid barrier OPEN by default.");
}

// ======================= LOOP =======================

void loop() {
  unsigned long now = millis();
  for (int i = 0; i < 4; i++) { processLane(i); delay(10); }

  if (now - lastDecisionTime > DECISION_INTERVAL_MS) {
    int totalLeft = lanes[0].intervalCount + lanes[1].intervalCount;
    int totalRight = lanes[2].intervalCount + lanes[3].intervalCount;
    float lAvg = (leftSpeedCount > 0) ? (leftSpeedSum / leftSpeedCount) : 0;
    float rAvg = (rightSpeedCount > 0) ? (rightSpeedSum / rightSpeedCount) : 0;

    Serial.printf("\n10s REPORT -> Left: %d | Right: %d\n", totalLeft, totalRight);

    // --- UPDATED COMPARATIVE LOGIC ---

    // ONLY condition where Mid Barrier goes DOWN
    if (totalLeft == totalRight && totalLeft >= MIN_CAR_THRESHOLD) {
      Serial.println("PRIORITY: EQUAL. Mid DOWN, Sides UP.");
      moveSmooth(servoMid, currentPosMid, POS_CLOSED);
      moveSmooth(servoLeft, currentPosLeft, POS_OPEN);
      moveSmooth(servoRight, currentPosRight, POS_OPEN);
    } 
    // Left is busier (Mid MUST be UP)
    else if (totalLeft > totalRight && totalLeft >= MIN_CAR_THRESHOLD) {
      Serial.println("PRIORITY: LEFT side. Mid UP, Left UP, Right DOWN.");
      moveSmooth(servoMid, currentPosMid, POS_OPEN); // Keep it up
      moveSmooth(servoLeft, currentPosLeft, POS_OPEN);
      moveSmooth(servoRight, currentPosRight, POS_CLOSED);
    } 
    // Right is busier (Mid MUST be UP)
    else if (totalRight > totalLeft && totalRight >= MIN_CAR_THRESHOLD) {
      Serial.println("PRIORITY: RIGHT side. Mid UP, Right UP, Left DOWN.");
      moveSmooth(servoMid, currentPosMid, POS_OPEN); // Keep it up
      moveSmooth(servoRight, currentPosRight, POS_OPEN);
      moveSmooth(servoLeft, currentPosLeft, POS_CLOSED);
    } 
    // Default (Low Traffic or Both Busy but unequal and < threshold)
    else {
      Serial.println("PRIORITY: NONE (Low Traffic). Mid UP, Sides DOWN.");
      moveSmooth(servoMid, currentPosMid, POS_OPEN); // Keep it up
      moveSmooth(servoLeft, currentPosLeft, POS_CLOSED);
      moveSmooth(servoRight, currentPosRight, POS_CLOSED);
    }

    sendToFirebase(totalLeft, lAvg, totalRight, rAvg);
    for(int i=0; i<4; i++) lanes[i].intervalCount = 0;
    leftSpeedSum = 0; leftSpeedCount = 0; rightSpeedSum = 0; rightSpeedCount = 0;
    lastDecisionTime = now;
  }
}