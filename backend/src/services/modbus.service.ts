import net from 'net';
import { config } from '../config/env';

/**
 * Modbus Holding Register offsets (0-indexed matching ESP32 firmware 40001-40031)
 */
export const MODBUS_REG = {
  WEIGHT_G: 0,        // 40001-02  F32 (grams)
  STABLE_G: 2,        // 40003-04  F32 (grams)
  RAW: 4,             // 40005-06  F32
  OFFSET: 6,          // 40007-08  F32
  CPK: 8,             // 40009-10  F32
  STATUS: 10,         // 40011     U16
  RSSI: 11,           // 40012     I16
  WIFI_MODE: 12,      // 40013     U16
  FW_VER: 13,         // 40014     U16
  UPTIME: 14,         // 40015     U16
  CMD: 15,            // 40016     U16
  CMD_ARG: 16,        // 40017-18  F32
  CLIENT_CONN: 26,    // 40027     U16
  NUM_REGS: 31,
};

export const MODBUS_STATUS_BITS = {
  HX711_READY: 0x0001,
  CALIBRATED: 0x0002,
  STA_CONNECTED: 0x0004,
  CMD_PENDING: 0x0008,
  WEIGHT_STABLE: 0x0010,
};

export const MODBUS_COMMANDS = {
  TARE: 1,
  CALIBRATE: 2,
  RESET_SESSION: 3,
  FLUSH: 4,
  ZERO: 8,
};

export interface ScaleTelemetry {
  stationId: string;
  name: string;
  capacityKg: number;
  online: boolean;
  ip: string;
  port: number;
  weightKg: number;
  stableWeightKg: number;
  weightGrams: number;
  isStable: boolean;
  statusFlags: string;
  uptimeSec: number;
  rssi?: number;
  timestamp: string;
}

/**
 * Decode two 16-bit words (high word first, big-endian) into IEEE 754 float32
 */
function wordsToFloat(hi: number, lo: number): number {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(hi & 0xffff, 0);
  buf.writeUInt16BE(lo & 0xffff, 2);
  return buf.readFloatBE(0);
}

/**
 * Encode float32 to two 16-bit words
 */
function floatToWords(val: number): [number, number] {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(val, 0);
  return [buf.readUInt16BE(0), buf.readUInt16BE(2)];
}

/**
 * Low-level Modbus TCP query using Node.js built-in net.Socket
 */
export async function readHoldingRegisters(
  host: string,
  port: number,
  startAddr = 0,
  count = 31,
  timeoutMs = 1500
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Modbus TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    socket.connect(port, host, () => {
      // Build MBAP frame + Function Code 0x03
      // Transaction ID: 1, Protocol ID: 0, Length: 6, Unit ID: 1
      const mbap = Buffer.alloc(7);
      mbap.writeUInt16BE(0x0001, 0); // TID
      mbap.writeUInt16BE(0x0000, 2); // PID
      mbap.writeUInt16BE(0x0006, 4); // Length (6 bytes to follow)
      mbap.writeUInt8(0x01, 6);      // UID

      const pdu = Buffer.alloc(5);
      pdu.writeUInt8(0x03, 0);       // FC 0x03
      pdu.writeUInt16BE(startAddr, 1);
      pdu.writeUInt16BE(count, 3);

      socket.write(Buffer.concat([mbap, pdu]));
    });

    let rxBuffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);
      if (rxBuffer.length >= 9) {
        const respFc = rxBuffer.readUInt8(7);
        if (respFc === 0x03) {
          const byteCount = rxBuffer.readUInt8(8);
          if (rxBuffer.length >= 9 + byteCount) {
            const registers: number[] = [];
            for (let i = 0; i < byteCount; i += 2) {
              registers.push(rxBuffer.readUInt16BE(9 + i));
            }
            if (!settled) {
              settled = true;
              cleanup();
              resolve(registers);
            }
          }
        } else if (respFc >= 0x80) {
          const excCode = rxBuffer.readUInt8(8);
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error(`Modbus exception code: ${excCode}`));
          }
        }
      }
    });
  });
}

/**
 * Write a single register using Function Code 0x06
 */
export async function writeSingleRegister(
  host: string,
  port: number,
  addr: number,
  value: number,
  timeoutMs = 1500
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Modbus write to ${host}:${port} timed out`));
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });

    socket.connect(port, host, () => {
      const mbap = Buffer.alloc(7);
      mbap.writeUInt16BE(0x0002, 0); // TID
      mbap.writeUInt16BE(0x0000, 2); // PID
      mbap.writeUInt16BE(0x0006, 4); // Length
      mbap.writeUInt8(0x01, 6);      // UID

      const pdu = Buffer.alloc(5);
      pdu.writeUInt8(0x06, 0);       // FC 0x06
      pdu.writeUInt16BE(addr, 1);
      pdu.writeUInt16BE(value & 0xffff, 3);

      socket.write(Buffer.concat([mbap, pdu]));
    });

    socket.on('data', (chunk) => {
      if (chunk.length >= 8) {
        const fc = chunk.readUInt8(7);
        if (!settled) {
          settled = true;
          cleanup();
          resolve(fc === 0x06);
        }
      }
    });
  });
}

/**
 * Get station configuration by station ID ('01', '02', '03')
 */
export function getStationConfig(stationId: string) {
  const normalized = stationId
    .replace(/^ws-/, '')
    .replace(/^st-/, '')
    .replace(/^station-/, '')
    .replace(/^scale-/, '')
    .padStart(2, '0');
  if (normalized === '01') return config.scales.station01;
  if (normalized === '02') return config.scales.station02;
  if (normalized === '03') return config.scales.station03;
  return null;
}

interface CachedTelemetry {
  telemetry: ScaleTelemetry;
  fetchedAt: number;
}
const telemetryCache = new Map<string, CachedTelemetry>();
const inflightQueries = new Map<string, Promise<ScaleTelemetry>>();
const CACHE_TTL_MS = 250; // Cache live readings for 250ms to deduplicate concurrent requests

/**
 * Query live telemetry from a specific station's scale
 */
export async function getScaleTelemetry(stationId: string): Promise<ScaleTelemetry> {
  const station = getStationConfig(stationId);
  const now = new Date().toISOString();

  if (!station) {
    throw new Error(`Unknown scale station ID: ${stationId}`);
  }

  const cached = telemetryCache.get(station.id);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.telemetry;
  }

  const inflight = inflightQueries.get(station.id);
  if (inflight) {
    return inflight;
  }

  const queryPromise = (async () => {
    try {
      const regs = await readHoldingRegisters(station.host, station.port, 0, MODBUS_REG.NUM_REGS, 1200);
      const weightG = wordsToFloat(regs[MODBUS_REG.WEIGHT_G], regs[MODBUS_REG.WEIGHT_G + 1]);
      const stableG = wordsToFloat(regs[MODBUS_REG.STABLE_G], regs[MODBUS_REG.STABLE_G + 1]);
      const status = regs[MODBUS_REG.STATUS];
      const uptimeSec = regs[MODBUS_REG.UPTIME];
      const isStable = Boolean(status & MODBUS_STATUS_BITS.WEIGHT_STABLE);

      const result: ScaleTelemetry = {
        stationId: station.id,
        name: station.name,
        capacityKg: station.capacityKg,
        online: true,
        ip: station.host,
        port: station.port,
        weightKg: parseFloat((weightG / 1000.0).toFixed(3)),
        stableWeightKg: parseFloat((stableG / 1000.0).toFixed(3)),
        weightGrams: parseFloat(weightG.toFixed(1)),
        isStable,
        statusFlags: `0x${status.toString(16).toUpperCase().padStart(4, '0')}`,
        uptimeSec,
        timestamp: now,
      };

      telemetryCache.set(station.id, { telemetry: result, fetchedAt: Date.now() });
      return result;
    } catch {
      // Return last known reading marked offline or safe default
      const last = telemetryCache.get(station.id);
      if (last && (Date.now() - last.fetchedAt) < 5000) {
        return { ...last.telemetry, online: false, timestamp: now };
      }

      return {
        stationId: station.id,
        name: station.name,
        capacityKg: station.capacityKg,
        online: false,
        ip: station.host,
        port: station.port,
        weightKg: 0.0,
        stableWeightKg: 0.0,
        weightGrams: 0.0,
        isStable: false,
        statusFlags: '0x0000',
        uptimeSec: 0,
        timestamp: now,
      };
    } finally {
      inflightQueries.delete(station.id);
    }
  })();

  inflightQueries.set(station.id, queryPromise);
  return queryPromise;
}

/**
 * Send Tare command (CMD=1) to scale
 */
export async function tareScale(stationId: string): Promise<boolean> {
  const station = getStationConfig(stationId);
  if (!station) throw new Error(`Unknown station ID: ${stationId}`);
  telemetryCache.delete(station.id);
  return writeSingleRegister(station.host, station.port, MODBUS_REG.CMD, MODBUS_COMMANDS.TARE);
}

/**
 * Send Zero command (CMD=8) to scale
 */
export async function zeroScale(stationId: string): Promise<boolean> {
  const station = getStationConfig(stationId);
  if (!station) throw new Error(`Unknown station ID: ${stationId}`);
  telemetryCache.delete(station.id);
  return writeSingleRegister(station.host, station.port, MODBUS_REG.CMD, MODBUS_COMMANDS.ZERO);
}

/**
 * Update station IP host and port dynamically (e.g. from Scale Settings UI)
 */
export function updateStationConfig(stationId: string, host: string, port: number): boolean {
  const station = getStationConfig(stationId);
  if (!station) return false;
  station.host = host.trim();
  station.port = Number(port);
  telemetryCache.delete(station.id);
  inflightQueries.delete(station.id);
  return true;
}

/**
 * Test direct hardware connection to a scale transmitter
 */
export async function testStationConnection(stationId: string): Promise<{ online: boolean; message: string; host: string; port: number }> {
  const station = getStationConfig(stationId);
  if (!station) {
    throw new Error(`Unknown station ID ${stationId}`);
  }
  try {
    const regs = await readHoldingRegisters(station.host, station.port, 0, 2, 1500);
    return {
      online: Array.isArray(regs) && regs.length >= 2,
      message: `Successfully connected to Modbus TCP hardware transmitter at ${station.host}:${station.port}`,
      host: station.host,
      port: station.port,
    };
  } catch (err: any) {
    return {
      online: false,
      message: `Failed to connect to ${station.host}:${station.port}: ${err.message || 'Connection refused or timeout'}`,
      host: station.host,
      port: station.port,
    };
  }
}

/**
 * Return telemetry for all 3 packhouse workstations
 */
export async function getAllScalesTelemetry(): Promise<ScaleTelemetry[]> {
  const [s1, s2, s3] = await Promise.all([
    getScaleTelemetry('01'),
    getScaleTelemetry('02'),
    getScaleTelemetry('03'),
  ]);
  return [s1, s2, s3];
}

