#ifndef EVENT_BUS_H
#define EVENT_BUS_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

enum class EventType : uint16_t {
  SYSTEM_BOOT = 0x0001,
  SYSTEM_SHUTDOWN,
  SYSTEM_ERROR,
  SYSTEM_WATCHDOG,
  NETWORK_CONNECTED,
  NETWORK_DISCONNECTED,
  DEVICE_REGISTERED,
  DEVICE_CONFIG_UPDATED,
  SENSOR_READ_COMPLETE,
  SENSOR_ERROR,
  ACTUATOR_COMMAND_RECEIVED,
  ACTUATOR_STATE_CHANGED,
  RULE_TRIGGERED,
  RULE_EXECUTED
};

enum class EventPriority : uint8_t {
  PRIO_LOW = 0,
  NORMAL,
  PRIO_HIGH,
  CRITICAL
};

struct Event {
  EventType type;
  EventPriority priority;
  uint32_t timestamp_ms;
  uint32_t sender_id;
  union {


    struct {
      uint8_t sensor_id;
      float value;
    } sensor_reading;

    struct {
      uint8_t actuator_id;
      float value;
    } actuator_command;

    struct {
      int error_code;
      char message[64];
    } system_error;
  };
};

class EventBus {
 public:
  EventBus();
  ~EventBus();

  bool begin(uint16_t queueSize = 16);
  void post(const Event& event);
  bool subscribe(EventType type, void (*handler)(const Event&, void*), void* user_data);
  void process();

 private:
  QueueHandle_t _queue;
  static const uint16_t MAX_SUBSCRIBERS = 8;
  struct Subscriber {
    EventType type;
    void (*handler)(const Event&, void*);
    void* user_data;
  } _subscribers[MAX_SUBSCRIBERS];
  uint8_t _subscriberCount;
};

#endif
