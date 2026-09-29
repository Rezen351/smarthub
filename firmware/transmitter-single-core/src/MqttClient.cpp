#include "MqttClient.h"
#include "Logger.h"
#include "SharedState.h"
#include "Settings.h"
#include "config.h"

#include <WiFi.h>
#include <PubSubClient.h>

extern SharedState gShared;

static WiFiClient _wifiClient;
static PubSubClient _mqtt(_wifiClient);

MqttClient::MqttClient() : _connected(false), _port(0), _lastConnectAttempt(0), _reconnectInterval(5000), _willSet(false) {
  memset(_server, 0, sizeof(_server));
  memset(_client_id, 0, sizeof(_client_id));
  memset(_username, 0, sizeof(_username));
  memset(_password, 0, sizeof(_password));
  memset(_will_topic, 0, sizeof(_will_topic));
  memset(_will_payload, 0, sizeof(_will_payload));
}

MqttClient::~MqttClient() {
  disconnect();
}

bool MqttClient::begin(const char* server, uint16_t port, const char* client_id, const char* username, const char* password) {
  strncpy(_server, server, sizeof(_server) - 1);
  _port = port;
  strncpy(_client_id, client_id, sizeof(_client_id) - 1);
  if (username) strncpy(_username, username, sizeof(_username) - 1);
  if (password) strncpy(_password, password, sizeof(_password) - 1);

  _mqtt.setServer(_server, _port);
  _mqtt.setCallback([](char* topic, byte* payload, unsigned int length) {
    LOG_INFO("mqtt", "message received topic=%s length=%u", topic, length);
  });

  LOG_INFO("mqtt", "initialized server=%s port=%u client_id=%s", _server, (unsigned)_port, _client_id);
  return true;
}

void MqttClient::loop() {
  if (!_connected) {
    uint32_t now = millis();
    if ((now - _lastConnectAttempt) >= _reconnectInterval) {
      _lastConnectAttempt = now;
      connect();
    }
    return;
  }

  if (!_mqtt.connected()) {
    handleDisconnect();
    return;
  }

  _mqtt.loop();
}

void MqttClient::connect() {
  LOG_INFO("mqtt", "connecting to %s:%u...", _server, (unsigned)_port);

  if (_willSet && strlen(_will_topic) > 0) {
    _mqtt.connect(_client_id, _username[0] ? _username : NULL, _password[0] ? _password : NULL, _will_topic, 1, true, _will_payload);
  } else {
    _mqtt.connect(_client_id, _username[0] ? _username : NULL, _password[0] ? _password : NULL);
  }

  if (_mqtt.connected()) {
    handleConnect();
  } else {
    LOG_WARN("mqtt", "connection failed state=%d", (int)_mqtt.state());
    _reconnectInterval = _reconnectInterval < 30000 ? _reconnectInterval * 2 : 30000;
  }
}

void MqttClient::handleConnect() {
  _connected = true;
  _reconnectInterval = 5000;
  LOG_INFO("mqtt", "connected to broker");

  if (_willSet && strlen(_will_topic) > 0) {
    _mqtt.publish(_will_topic, _will_payload, true);
  }
}

void MqttClient::handleDisconnect() {
  _connected = false;
  _reconnectInterval = 5000;
  LOG_WARN("mqtt", "disconnected from broker");
}

void MqttClient::publish(const char* topic, const char* payload, bool retained) {
  if (!_connected || !_mqtt.connected()) {
    LOG_WARN("mqtt", "publish skipped: not connected topic=%s", topic);
    return;
  }

  if (_mqtt.publish(topic, payload, retained)) {
    LOG_INFO("mqtt", "publish topic=%s payload=%s retained=%u", topic, payload, retained ? 1 : 0);
  } else {
    LOG_WARN("mqtt", "publish failed topic=%s", topic);
  }
}

void MqttClient::subscribe(const char* topic) {
  if (!_connected || !_mqtt.connected()) {
    LOG_WARN("mqtt", "subscribe skipped: not connected topic=%s", topic);
    return;
  }

  if (_mqtt.subscribe(topic)) {
    LOG_INFO("mqtt", "subscribe topic=%s", topic);
  } else {
    LOG_WARN("mqtt", "subscribe failed topic=%s", topic);
  }
}

void MqttClient::setWill(const char* topic, const char* payload) {
  strncpy(_will_topic, topic, sizeof(_will_topic) - 1);
  strncpy(_will_payload, payload, sizeof(_will_payload) - 1);
  _willSet = true;
  LOG_INFO("mqtt", "last will set topic=%s payload=%s", _will_topic, _will_payload);
}

void MqttClient::disconnect() {
  if (_connected) {
    LOG_INFO("mqtt", "disconnecting");
    _mqtt.disconnect();
    _connected = false;
  }
}
