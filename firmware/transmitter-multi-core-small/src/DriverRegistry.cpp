#include "DriverRegistry.h"
#include "Logger.h"

SensorFactory DriverRegistry::_sensorFactories[MAX_REGISTRATIONS];
const char* DriverRegistry::_sensorNames[MAX_REGISTRATIONS];
uint8_t DriverRegistry::_sensorCount = 0;

ActuatorFactory DriverRegistry::_actuatorFactories[MAX_REGISTRATIONS];
const char* DriverRegistry::_actuatorNames[MAX_REGISTRATIONS];
uint8_t DriverRegistry::_actuatorCount = 0;

ProtocolFactory DriverRegistry::_protocolFactories[MAX_REGISTRATIONS];
const char* DriverRegistry::_protocolNames[MAX_REGISTRATIONS];
uint8_t DriverRegistry::_protocolCount = 0;

void DriverRegistry::registerSensor(const char* name, SensorFactory factory) {
  if (_sensorCount >= MAX_REGISTRATIONS) {
    LOG_ERROR("registry", "sensor registry full, cannot register '%s'", name);
    return;
  }
  _sensorNames[_sensorCount] = name;
  _sensorFactories[_sensorCount] = factory;
  _sensorCount++;
  LOG_INFO("registry", "registered sensor driver '%s'", name);
}

void DriverRegistry::registerActuator(const char* name, ActuatorFactory factory) {
  if (_actuatorCount >= MAX_REGISTRATIONS) {
    LOG_ERROR("registry", "actuator registry full, cannot register '%s'", name);
    return;
  }
  _actuatorNames[_actuatorCount] = name;
  _actuatorFactories[_actuatorCount] = factory;
  _actuatorCount++;
  LOG_INFO("registry", "registered actuator driver '%s'", name);
}

void DriverRegistry::registerProtocol(const char* name, ProtocolFactory factory) {
  if (_protocolCount >= MAX_REGISTRATIONS) {
    LOG_ERROR("registry", "protocol registry full, cannot register '%s'", name);
    return;
  }
  _protocolNames[_protocolCount] = name;
  _protocolFactories[_protocolCount] = factory;
  _protocolCount++;
  LOG_INFO("registry", "registered protocol driver '%s'", name);
}

ISensorDriver* DriverRegistry::createSensor(const char* name) {
  for (uint8_t i = 0; i < _sensorCount; i++) {
    if (strcmp(_sensorNames[i], name) == 0) {
      return _sensorFactories[i]();
    }
  }
  LOG_WARN("registry", "sensor driver '%s' not found", name);
  return nullptr;
}

IActuatorDriver* DriverRegistry::createActuator(const char* name) {
  for (uint8_t i = 0; i < _actuatorCount; i++) {
    if (strcmp(_actuatorNames[i], name) == 0) {
      return _actuatorFactories[i]();
    }
  }
  LOG_WARN("registry", "actuator driver '%s' not found", name);
  return nullptr;
}

IProtocolDriver* DriverRegistry::createProtocol(const char* name) {
  for (uint8_t i = 0; i < _protocolCount; i++) {
    if (strcmp(_protocolNames[i], name) == 0) {
      return _protocolFactories[i]();
    }
  }
  LOG_WARN("registry", "protocol driver '%s' not found", name);
  return nullptr;
}

void DriverRegistry::destroySensor(ISensorDriver* sensor) {
  delete sensor;
}

void DriverRegistry::destroyActuator(IActuatorDriver* actuator) {
  delete actuator;
}

void DriverRegistry::destroyProtocol(IProtocolDriver* protocol) {
  delete protocol;
}

const char** DriverRegistry::sensorNames(uint8_t& count) {
  count = _sensorCount;
  return _sensorNames;
}

const char** DriverRegistry::actuatorNames(uint8_t& count) {
  count = _actuatorCount;
  return _actuatorNames;
}

const char** DriverRegistry::protocolNames(uint8_t& count) {
  count = _protocolCount;
  return _protocolNames;
}
