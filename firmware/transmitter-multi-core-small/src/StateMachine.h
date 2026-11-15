#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <Arduino.h>

enum class SystemState : uint8_t {
  BOOT = 0,
  INIT,
  NORMAL,
  OTA_UPDATE,
  DIAGNOSTICS,
  SAFE_MODE,
  ERROR,
  SHUTDOWN
};

class StateMachine {
 public:
  StateMachine();

  void transition(SystemState newState);
  SystemState currentState() const { return _state; }

  void onEnter();
  void onExit();
  void onUpdate();
  void onEvent(uint16_t eventId);

  const char* stateName(SystemState state) const;

 private:
  SystemState _state;
  bool        _initialized;
};

#endif
