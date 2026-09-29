#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>
#include "EventBus.h"

class MqttClient {
 public:
  MqttClient();
  ~MqttClient();

  bool begin(const char* server, uint16_t port, const char* client_id, const char* username, const char* password);
  void loop();

  bool connected() const { return _connected; }
  void publish(const char* topic, const char* payload, bool retained = false);
  void subscribe(const char* topic);

  void setWill(const char* topic, const char* payload);
  void disconnect();

 private:
  bool _connected;
  char _server[64];
  uint16_t _port;
  char _client_id[32];
  char _username[64];
  char _password[64];
  char _will_topic[64];
  char _will_payload[64];
  uint32_t _lastConnectAttempt;
  uint32_t _reconnectInterval;
  bool _willSet;

  void connect();
  void handleConnect();
  void handleDisconnect();
};

#endif
