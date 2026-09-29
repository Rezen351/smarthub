#include "EventBus.h"
#include "Logger.h"

EventBus::EventBus() : _queue(nullptr), _subscriberCount(0) {}

EventBus::~EventBus() {
  if (_queue) vQueueDelete(_queue);
}

bool EventBus::begin(uint16_t queueSize) {
  _queue = xQueueCreate(queueSize, sizeof(Event));
  if (!_queue) {
    LOG_ERROR("eventbus", "failed to create event queue (size=%u)", (unsigned)queueSize);
    return false;
  }
  LOG_INFO("eventbus", "initialized (queue size=%u)", (unsigned)queueSize);
  return true;
}

void EventBus::post(const Event& event) {
  if (!_queue) return;
  if (xQueueSend(_queue, &event, 0) != pdTRUE) {
    LOG_WARN("eventbus", "event queue full, dropping event type=0x%04X", (unsigned)event.type);
  }
}

bool EventBus::subscribe(EventType type, void (*handler)(const Event&, void*), void* user_data) {
  if (_subscriberCount >= MAX_SUBSCRIBERS) {
    LOG_ERROR("eventbus", "subscriber limit reached (%u)", (unsigned)MAX_SUBSCRIBERS);
    return false;
  }
  _subscribers[_subscriberCount].type = type;
  _subscribers[_subscriberCount].handler = handler;
  _subscribers[_subscriberCount].user_data = user_data;
  _subscriberCount++;
  LOG_INFO("eventbus", "subscribed handler for event type=0x%04X", (unsigned)type);
  return true;
}

void EventBus::process() {
  if (!_queue) return;

  Event event;
  while (xQueueReceive(_queue, &event, 0) == pdTRUE) {
    for (uint8_t i = 0; i < _subscriberCount; i++) {
      if (_subscribers[i].type == event.type) {
        _subscribers[i].handler(event, _subscribers[i].user_data);
      }
    }
  }
}
