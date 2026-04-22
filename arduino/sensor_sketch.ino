const int PIR_PIN = 2;    // Pin conectado a "OUT" o "Data" del sensor PIR (cable verde en el dibujo)
const int BUZZER_PIN = 8; // Pin conectado a tu Buzzer

int pirState = LOW; // Estado del sensor
unsigned long lastSend = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  // Pequeña pausa para estabilizar el sensor 
  delay(1000); 
}

void loop() {
  int pirValue = digitalRead(PIR_PIN);
  
  // Detección inicial
  if (pirValue == HIGH && pirState == LOW) {
    Serial.println("{\"motion\": 1}");
    pirState = HIGH;
    
    // Activar Buzzer
    tone(BUZZER_PIN, 1000); 
    delay(500);             
    noTone(BUZZER_PIN);
    
    lastSend = millis(); // reiniciamos el reloj para el envío continúo
  } 
  // Fin de detección
  else if (pirValue == LOW && pirState == HIGH) {
    Serial.println("{\"motion\": 0}");
    pirState = LOW;
    lastSend = millis();
  }

  // Enviar estado cada 1 segundo (así nunca se pierden los datos en la web y sabes que sigue funcionando)
  if (millis() - lastSend >= 1000) {
    Serial.print("{\"motion\": ");
    Serial.print(pirState == HIGH ? 1 : 0);
    Serial.println("}");
    lastSend = millis();
  }
}
