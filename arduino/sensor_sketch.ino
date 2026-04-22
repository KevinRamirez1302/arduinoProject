
const int Trigger = 10;
const int Echo    = 5;
const int Buzzer  = 8;

const int UMBRAL_CM      = 30;    // Activa el buzzer si objeto < 30cm
const int DISTANCIA_MAX  = 400;   // El HC-SR04 llega máximo a ~400cm
const long TIMEOUT_US    = 25000; // 25ms → ~425cm máximo, evita lecturas falsas
const int SEND_INTERVAL  = 1000;  // Enviar cada 1 segundo

unsigned long lastSend = 0;

void setup() {
  Serial.begin(9600);
  pinMode(Trigger, OUTPUT);
  pinMode(Echo,    INPUT);
  pinMode(Buzzer,  OUTPUT);
  digitalWrite(Trigger, LOW);
  delay(500); // Pequeña pausa de estabilización
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL) return;
  lastSend = millis();

  // Disparo del pulso ultrasónico
  digitalWrite(Trigger, LOW);
  delayMicroseconds(2);
  digitalWrite(Trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(Trigger, LOW);

  // Leer eco con timeout (25ms caps ~425cm)
  long t = pulseIn(Echo, HIGH, TIMEOUT_US);

  // Si no hubo eco válido, no enviamos nada
  if (t == 0) {
    Serial.println(0);
    return;
  }

  // Fórmula estándar HC-SR04: d(cm) = t(µs) / 58
  long d = t / 58;

  // Descartar lecturas fuera del rango físico del sensor
  if (d > DISTANCIA_MAX) {
    Serial.println(0);
    return;
  }

  // Enviar distancia a la web
  Serial.println(d);

  // Buzzer: pita si objeto a menos de 30cm
  if (d > 0 && d < UMBRAL_CM) {
    // Usamos tone() para que funcione con cualquier tipo de buzzer
    tone(Buzzer, 1000); // Emite un tono de 1000Hz
    delay(100);         // Mantiene el tono 100ms
    noTone(Buzzer);     // Apaga el tono
  } else {
    noTone(Buzzer);
  }
}

