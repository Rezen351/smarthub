#ifndef DRIVER_REGISTRY_H
#define DRIVER_REGISTRY_H

#include <Arduino.h>

// Forward declarations
class ISensorDriver;
class IActuatorDriver;
class IProtocolDriver;

using SensorFactory = ISensorDriver* (*)();
using ActuatorFactory = IActuatorDriver* (*)();
using ProtocolFactory = IProtocolDriver* (*)();

class ISensorDriver {
 public:
  virtual ~ISensorDriver() = default;
  virtual void begin() = 0;
  virtual void loop() = 0;
  virtual const char* name() const = 0;
};

class IActuatorDriver {
 public:
  virtual ~IActuatorDriver() = default;
  virtual void begin() = 0;
  virtual void loop() = 0;
  virtual const char* name() const = 0;
};

class IProtocolDriver {
 public:
  virtual ~IProtocolDriver() = default;
  virtual void begin() = 0;
  virtual void loop() = 0;
  virtual const char* name() const = 0;
};

class DriverRegistry {
 public:
  static ISensorDriver* createSensor(const char* name);
  static IActuatorDriver* createActuator(const char* name);
  static IProtocolDriver* createProtocol(const char* name);

  static void destroySensor(ISensorDriver* sensor);
  static void destroyActuator(IActuatorDriver* actuator);
  static void destroyProtocol(IProtocolDriver* protocol);

  static void registerSensor(const char* name, SensorFactory factory);
  static void registerActuator(const char* name, ActuatorFactory factory);
  static void registerProtocol(const char* name, ProtocolFactory factory);

  static const char** sensorNames(uint8_t& count);
  static const char** actuatorNames(uint8_t& count);
  static const char** protocolNames(uint8_t& count);

 private:
  static const uint8_t MAX_REGISTRATIONS = 16;
  static SensorFactory _sensorFactories[MAX_REGISTRATIONS];
  static const char* _sensorNames[MAX_REGISTRATIONS];
  static uint8_t _sensorCount;

  static ActuatorFactory _actuatorFactories[MAX_REGISTRATIONS];
  static const char* _actuatorNames[MAX_REGISTRATIONS];
  static uint8_t _actuatorCount;

  static ProtocolFactory _protocolFactories[MAX_REGISTRATIONS];
  static const char* _protocolNames[MAX_REGISTRATIONS];
  static uint8_t _protocolCount;
};

#define REGISTER_SENSOR(name, factory) \
  namespace { \
    bool _reg_##factory = [](){ \
      DriverRegistry::registerSensor(name, factory); \
      return true; \
    }(); \
  }

#define REGISTER_ACTUATOR(name, factory) \
  namespace { \
    bool _reg_##factory = [](){ \
      DriverRegistry::registerActuator(name, factory); \
      return true; \
    }(); \
  }

#define REGISTER_PROTOCOL(name, factory) \
  namespace { \
    bool _reg_##factory = [](){ \
      DriverRegistry::registerProtocol(name, factory); \
      return true; \
    }(); \
  }

#endif
