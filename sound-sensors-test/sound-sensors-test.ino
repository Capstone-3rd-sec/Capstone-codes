#include <math.h>

// Sound sensor pins
#define SENSOR1_PIN 1
#define SENSOR2_PIN 3

// Audio parameters
#define SAMPLE_RATE 10000    // 10 kHz
#define SAMPLE_TIME 0.1      // 100ms sample window
#define SAMPLE_COUNT (SAMPLE_RATE * SAMPLE_TIME)  // 1000 samples

// Calibration
float baseline1 = 0, baseline2 = 0;

void setup() {
  Serial.begin(115200);
  
  // ADC Configuration for ESP32-S3
  // Simple setup without advanced functions
  analogReadResolution(12);  // 0-4095
  
  // Calibrate
  calibrateBaseline();
  
  Serial.println("Time(ms)\tSensor1(dB)\tSensor2(dB)\tRaw1\tRaw2");
}

void calibrateBaseline() {
  Serial.println("Calibrating baseline...");
  
  long sum1 = 0, sum2 = 0;
  for(int i = 0; i < 500; i++) {
    sum1 += analogRead(SENSOR1_PIN);
    sum2 += analogRead(SENSOR2_PIN);
    delay(2);
  }
  
  baseline1 = sum1 / 500.0;
  baseline2 = sum2 / 500.0;
  
  Serial.print("Baseline 1: "); Serial.println(baseline1);
  Serial.print("Baseline 2: "); Serial.println(baseline2);
}

float calculateDB(int pin, float baseline) {
  unsigned long sumSq = 0;
  int maxVal = 0;
  int minVal = 4095;
  
  unsigned long startTime = micros();
  
  // Sample at 10kHz for 100ms
  for(int i = 0; i < SAMPLE_COUNT; i++) {
    int raw = analogRead(pin);
    float adjusted = raw - baseline;
    
    sumSq += adjusted * adjusted;
    
    if(raw > maxVal) maxVal = raw;
    if(raw < minVal) minVal = raw;
    
    // Maintain sample rate - adjust delay as needed
    delayMicroseconds(50);  // 20kHz sampling
  }
  
  // Calculate RMS
  float rms = sqrt(sumSq / SAMPLE_COUNT);
  float rmsVoltage = (rms * 3.3) / 4095.0;
  
  // Calculate dB SPL
  float vRef = 0.001;  // Adjust this calibration factor
  float dB = 20.0 * log10(rmsVoltage / vRef);
  
  // Ensure reasonable range
  if(dB < 0) dB = 0;
  if(dB > 120) dB = 120;
  
  return dB;
}

void loop() {
  static unsigned long lastPrint = 0;
  
  // Read both sensors
  float db1 = calculateDB(SENSOR1_PIN, baseline1);
  float db2 = calculateDB(SENSOR2_PIN, baseline2);
  
  // Print at 10Hz
  if(millis() - lastPrint > 100) {
    Serial.print(millis());
    Serial.print("\t");
    Serial.print(db1, 1);
    Serial.print("\t\t");
    Serial.print(db2, 1);
    Serial.print("\t\t");
    Serial.print(analogRead(SENSOR1_PIN));
    Serial.print("\t");
    Serial.println(analogRead(SENSOR2_PIN));
    lastPrint = millis();
  }
}
