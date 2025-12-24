#define NUM_SENSORS 8

// TRIG and ECHO pins for each sensor
int trigPins[NUM_SENSORS] = {
  4, 6, 8, 10, 12, 14, 16, 18
};

int echoPins[NUM_SENSORS] = {
  5, 7, 9, 11, 13, 15, 17, 21
};

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
    digitalWrite(trigPins[i], LOW);
  }

  Serial.println("=== 8 HC-SR04 SENSORS ===");
}

// Measure distance for one sensor
float getDistance(int trigPin, int echoPin) {
  // Trigger pulse
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read echo (timeout 30 ms ≈ 5 m)
  long duration = pulseIn(echoPin, HIGH, 30000);

  if (duration == 0) {
    return -1.0; // No echo
  }

  // Distance in cm
  return duration * 0.0343 / 2.0;
}

void loop() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    float distance = getDistance(trigPins[i], echoPins[i]);

    Serial.print("Sensor ");
    Serial.print(i + 1);
    Serial.print(": ");

    if (distance < 0) {
      Serial.print("No echo");
    } else {
      Serial.print(distance);
      Serial.print(" cm");
    }

    Serial.print(" | ");

    // Delay to prevent ultrasonic interference
    delay(50);
  }

  Serial.println();
  delay(150);
}
