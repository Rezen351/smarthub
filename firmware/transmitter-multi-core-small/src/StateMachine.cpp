#include "StateMachine.h"
#include "Logger.h"

StateMachine::StateMachine() : _state(SystemState::BOOT), _initialized(false) {}

void StateMachine::transition(SystemState newState) {
  if (_state == newState) return;

  SystemState oldState = _state;
  _state = newState;

  LOG_INFO("fsm", "transition %s -> %s", stateName(oldState), stateName(newState));
}

void StateMachine::onEnter() {
  switch (_state) {
    case SystemState::BOOT:
      LOG_INFO("fsm", "onEnter BOOT");
      break;
    case SystemState::INIT:
      LOG_INFO("fsm", "onEnter INIT");
      break;
    case SystemState::NORMAL:
      LOG_INFO("fsm", "onEnter NORMAL");
      break;
    case SystemState::OTA_UPDATE:
      LOG_INFO("fsm", "onEnter OTA_UPDATE");
      break;
    case SystemState::DIAGNOSTICS:
      LOG_INFO("fsm", "onEnter DIAGNOSTICS");
      break;
    case SystemState::SAFE_MODE:
      LOG_WARN("fsm", "onEnter SAFE_MODE");
      break;
    case SystemState::ERROR:
      LOG_ERROR("fsm", "onEnter ERROR");
      break;
    case SystemState::SHUTDOWN:
      LOG_INFO("fsm", "onEnter SHUTDOWN");
      break;
  }
}

void StateMachine::onExit() {
  LOG_INFO("fsm", "onExit %s", stateName(_state));
}

void StateMachine::onUpdate() {
  switch (_state) {
    case SystemState::BOOT:
    case SystemState::INIT:
    case SystemState::NORMAL:
    case SystemState::OTA_UPDATE:
    case SystemState::DIAGNOSTICS:
    case SystemState::SAFE_MODE:
    case SystemState::ERROR:
    case SystemState::SHUTDOWN:
      break;
  }
}

void StateMachine::onEvent(uint16_t eventId) {
  LOG_INFO("fsm", "onEvent state=%s event=0x%04X", stateName(_state), eventId);
}

const char* StateMachine::stateName(SystemState state) const {
  switch (state) {
    case SystemState::BOOT:       return "BOOT";
    case SystemState::INIT:       return "INIT";
    case SystemState::NORMAL:     return "NORMAL";
    case SystemState::OTA_UPDATE: return "OTA_UPDATE";
    case SystemState::DIAGNOSTICS:return "DIAGNOSTICS";
    case SystemState::SAFE_MODE:  return "SAFE_MODE";
    case SystemState::ERROR:      return "ERROR";
    case SystemState::SHUTDOWN:   return "SHUTDOWN";
  }
  return "UNKNOWN";
}
