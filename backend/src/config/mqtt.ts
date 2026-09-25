import { config } from '../config/env';

export const mqttConfig = {
  url: config.mqtt.brokerUrl,
  options: {
    clientId: `enyx-backend-${process.pid}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  },
  topics: {
    scaleReadings: 'enyx/#',
    commands: 'enyx/+/+/command',
    status: 'enyx/+/+/status',
  },
};

export default mqttConfig;
