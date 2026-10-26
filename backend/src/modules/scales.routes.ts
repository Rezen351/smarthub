import { Router } from 'express';
import {
  getAllScalesTelemetry,
  getScaleTelemetry,
  tareScale,
  zeroScale,
  updateStationConfig,
  testStationConnection,
} from '../services/modbus.service';

const router = Router();

/**
 * GET /api/scales
 * Returns telemetry and connection status for all 3 packhouse scale transmitters
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const scales = await getAllScalesTelemetry();
    res.json({
      success: true,
      data: scales,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SCALE_ERROR', message: err.message || 'Failed to poll scale telemetry' },
    });
  }
});

/**
 * GET /api/scales/:stationId/weight
 * Returns real-time weight reading for a specific station ('01', '02', '03')
 */
router.get('/:stationId/weight', async (req, res): Promise<void> => {
  try {
    const { stationId } = req.params;
    const telemetry = await getScaleTelemetry(stationId);
    res.json({
      success: true,
      data: telemetry,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { code: 'STATION_NOT_FOUND', message: err.message || 'Scale station not found' },
    });
  }
});

/**
 * PUT /api/scales/:stationId/config
 * Dynamically updates IP address host and port for a scale station (e.g. connecting to real hardware)
 */
router.put('/:stationId/config', async (req, res): Promise<void> => {
  try {
    const { stationId } = req.params;
    const { host, port } = req.body;

    if (!host || !port || isNaN(Number(port))) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid host IP and port are required' },
      });
      return;
    }

    const updated = updateStationConfig(stationId, String(host), Number(port));
    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'STATION_NOT_FOUND', message: `Station '${stationId}' not found` },
      });
      return;
    }

    const testResult = await testStationConnection(stationId);

    res.json({
      success: true,
      data: {
        stationId,
        host: String(host).trim(),
        port: Number(port),
        online: testResult.online,
        message: testResult.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CONFIG_UPDATE_FAILED', message: err.message || 'Failed to update scale configuration' },
    });
  }
});

/**
 * POST /api/scales/:stationId/test
 * Tests direct Modbus TCP connection to a scale transmitter
 */
router.post('/:stationId/test', async (req, res): Promise<void> => {
  try {
    const { stationId } = req.params;
    const result = await testStationConnection(stationId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { code: 'STATION_NOT_FOUND', message: err.message || 'Station not found' },
    });
  }
});

/**
 * POST /api/scales/:stationId/tare
 * Triggers hardware tare command on the Modbus transmitter
 */
router.post('/:stationId/tare', async (req, res): Promise<void> => {
  try {
    const { stationId } = req.params;
    const ok = await tareScale(stationId);
    res.json({
      success: true,
      data: {
        stationId,
        action: 'TARE',
        acknowledged: ok,
        message: 'Scale tared successfully via Modbus TCP',
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'TARE_FAILED', message: err.message || 'Failed to execute tare command' },
    });
  }
});

/**
 * POST /api/scales/:stationId/zero
 * Triggers zero calibration on the Modbus transmitter
 */
router.post('/:stationId/zero', async (req, res): Promise<void> => {
  try {
    const { stationId } = req.params;
    const ok = await zeroScale(stationId);
    res.json({
      success: true,
      data: {
        stationId,
        action: 'ZERO',
        acknowledged: ok,
        message: 'Scale zeroed successfully via Modbus TCP',
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'ZERO_FAILED', message: err.message || 'Failed to execute zero command' },
    });
  }
});

export default router;
