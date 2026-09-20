/**
 * E-Tani Smart Hub - Weight Transmitter Client Application
 * Communicates with ESP32 WebPortal endpoints via JSON API.
 */

(() => {
  const el = (id) => document.getElementById(id);

  const ui = {
    barUptime: el('barUptime'),
    barFw: el('barFw'),
    barIp: el('barIp'),

    badgeSensor: el('badgeSensor'),
    badgeCalib: el('badgeCalib'),
    badgeModbusClients: el('badgeModbusClients'),

    valWeightKg: el('valWeightKg'),
    valStableKg: el('valStableKg'),
    valRawCounts: el('valRawCounts'),
    valOffset: el('valOffset'),
    valCpk: el('valCpk'),

    valTotalKg: el('valTotalKg'),
    valSampleCount: el('valSampleCount'),
    valMinKg: el('valMinKg'),
    valMaxKg: el('valMaxKg'),

    valWifiSta: el('valWifiSta'),
    valWifiRssi: el('valWifiRssi'),
    valWifiAp: el('valWifiAp'),

    knownKg: el('knownKg'),
    btnTare: el('btnTare'),
    btnCapturePoint: el('btnCapturePoint'),
    btnApplyMulti: el('btnApplyMulti'),
    btnClearPoints: el('btnClearPoints'),
    btnResetTotals: el('btnResetTotals'),
    btnFactoryReset: el('btnFactoryReset'),
    btnForgetWifi: el('btnForgetWifi'),

    calibPointsBody: el('calibPointsBody'),
    calibEmptyRow: el('calibEmptyRow'),
    regressionResults: el('regressionResults'),
    valSlope: el('valSlope'),
    valIntercept: el('valIntercept'),
    valR2: el('valR2'),
    valStdErr: el('valStdErr'),

    wifiForm: el('wifiForm'),
    wmode: el('wmode'),
    ssid: el('ssid'),
    psk: el('psk'),
    pskGroup: el('pskGroup'),
    entFields: el('entFields'),
    eid: el('eid'),
    eusr: el('eusr'),
    epwd: el('epwd'),

    toast: el('toast')
  };

  let toastTimer = null;
  let calibPoints = [];
  let regression = null;

  function showToast(message, isError = false) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.className = 'toast' + (isError ? ' toast-error' : '');
    ui.toast.style.display = 'block';

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ui.toast.style.display = 'none';
    }, 3200);
  }

  async function apiCall(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, Object.assign({
        headers: { 'Accept': 'application/json' }
      }, options));
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`[API] Error contacting ${endpoint}:`, err);
      return null;
    }
  }

  function formatGramsToKg(g) {
    return ((g || 0) / 1000.0).toFixed(3);
  }

  function computeRegression(points) {
    const n = points.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const p of points) {
      const x = p.weightKg;
      const y = p.rawCounts;
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-9) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    let ssRes = 0, ssTot = 0;
    const meanY = sumY / n;
    for (const p of points) {
      const y = p.rawCounts;
      const predicted = slope * p.weightKg + intercept;
      ssRes += (y - predicted) ** 2;
      ssTot += (y - meanY) ** 2;
    }

    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const stdErrCounts = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const stdErrKg = slope !== 0 ? stdErrCounts / Math.abs(slope) : 0;

    return { slope, intercept, r2, stdErrCounts, stdErrKg, n };
  }

  function renderCalibPoints() {
    if (!ui.calibPointsBody) return;

    ui.calibPointsBody.innerHTML = '';
    if (calibPoints.length === 0) {
      const tr = document.createElement('tr');
      tr.id = 'calibEmptyRow';
      tr.innerHTML = '<td colspan="4" style="color: var(--text-light); text-align: center; padding: 12px;">No calibration points captured yet</td>';
      ui.calibPointsBody.appendChild(tr);
    } else {
      calibPoints.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td class="font-mono">${p.weightKg.toFixed(3)}</td>
          <td class="font-mono">${Math.round(p.rawCounts).toLocaleString()}</td>
          <td><button type="button" class="btn btn-outline-danger btn-sm" data-idx="${idx}">Delete</button></td>
        `;
        ui.calibPointsBody.appendChild(tr);
      });

      ui.calibPointsBody.querySelectorAll('button[data-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          calibPoints.splice(idx, 1);
          updateRegression();
          renderCalibPoints();
        });
      });
    }

    if (ui.btnClearPoints) {
      ui.btnClearPoints.disabled = calibPoints.length === 0;
    }
  }

  function updateRegression() {
    regression = computeRegression(calibPoints);

    if (regression && ui.regressionResults) {
      ui.regressionResults.style.display = 'grid';
      if (ui.valSlope) ui.valSlope.textContent = regression.slope.toFixed(1);
      if (ui.valIntercept) ui.valIntercept.textContent = regression.intercept.toFixed(1);
      if (ui.valR2) ui.valR2.textContent = regression.r2.toFixed(5);
      if (ui.valStdErr) ui.valStdErr.textContent = regression.stdErrKg.toFixed(3);
    } else if (ui.regressionResults) {
      ui.regressionResults.style.display = 'none';
    }

    if (ui.btnApplyMulti) {
      ui.btnApplyMulti.disabled = !regression || calibPoints.length < 2;
    }
  }

  // Update Live Telemetry
  async function refreshStatus() {
    const data = await apiCall('/api/status');
    if (!data) {
      if (ui.barIp) ui.barIp.textContent = 'Disconnected';
      return;
    }

    if (ui.valWeightKg) ui.valWeightKg.textContent = (data.weightKg !== undefined) ? data.weightKg.toFixed(3) : '0.000';
    if (ui.valStableKg) ui.valStableKg.textContent = formatGramsToKg(data.stableG) + ' kg';
    if (ui.valRawCounts) ui.valRawCounts.textContent = Math.round(data.raw || 0).toLocaleString();

    if (ui.badgeSensor) {
      if (data.sensorReady) {
        ui.badgeSensor.textContent = 'Sensor: Ready';
        ui.badgeSensor.className = 'badge badge-ok';
      } else {
        ui.badgeSensor.textContent = 'Sensor: Initializing';
        ui.badgeSensor.className = 'badge badge-warning';
      }
    }

    if (ui.badgeCalib) {
      if (data.calibrated) {
        ui.badgeCalib.textContent = 'Calibrated';
        ui.badgeCalib.className = 'badge badge-ok';
      } else {
        ui.badgeCalib.textContent = 'Uncalibrated';
        ui.badgeCalib.className = 'badge badge-danger';
      }
    }

    if (ui.valOffset) ui.valOffset.textContent = Math.round(data.offset || 0).toLocaleString();
    if (ui.valCpk) {
      ui.valCpk.textContent = (data.countsPerKg > 0) ? data.countsPerKg.toFixed(1) : '--';
    }

    if (ui.valTotalKg) ui.valTotalKg.textContent = formatGramsToKg(data.totalG) + ' kg';
    if (ui.valSampleCount) ui.valSampleCount.textContent = (data.sampleCount || 0).toLocaleString();
    if (ui.valMinKg) ui.valMinKg.textContent = formatGramsToKg(data.minG) + ' kg';
    if (ui.valMaxKg) ui.valMaxKg.textContent = formatGramsToKg(data.maxG) + ' kg';

    if (ui.badgeModbusClients) {
      ui.badgeModbusClients.textContent = 'Clients: ' + (data.modbusClients || 0);
    }

    if (ui.barUptime) ui.barUptime.textContent = 'Uptime: ' + (data.uptime || 0) + 's';
    if (ui.barFw) ui.barFw.textContent = 'FW: v' + (data.fw || '1.0');

    const w = data.wifi || {};
    if (ui.barIp) ui.barIp.textContent = 'IP: ' + (w.staIp || w.apIp || '--');

    if (ui.valWifiSta) {
      const isConn = (w.status === 'connected');
      ui.valWifiSta.textContent = isConn ? `Connected (${w.modeName || 'Station'}) - ${w.staIp}` : 'Disconnected';
      ui.valWifiSta.style.color = isConn ? 'var(--status-ok)' : 'var(--text-muted)';
    }

    if (ui.valWifiRssi) {
      ui.valWifiRssi.textContent = (w.rssi && w.rssi > -127) ? `${w.rssi} dBm` : '--';
    }

    if (ui.valWifiAp) {
      ui.valWifiAp.textContent = `${w.apSsid || 'ENYX-SMARTHUB'} @ ${w.apIp || '192.168.4.1'}`;
    }
  }

  async function loadConfig() {
    const cfg = await apiCall('/api/config');
    if (!cfg) return;

    if (ui.wmode) ui.wmode.value = String(cfg.wifiMode || 0);
    if (ui.ssid) ui.ssid.value = cfg.ssid || '';
    if (ui.psk) ui.psk.value = cfg.wpaPassword || '';
    if (ui.eid) ui.eid.value = cfg.entIdentity || '';
    if (ui.eusr) ui.eusr.value = cfg.entUsername || '';
    if (ui.epwd) ui.epwd.value = cfg.entPassword || '';

    updateModeVisibility();
  }

  function updateModeVisibility() {
    const mode = ui.wmode ? ui.wmode.value : '0';
    const isEnterprise = (mode === '2');
    const isPsk = (mode === '1');

    if (ui.entFields) {
      ui.entFields.style.display = isEnterprise ? 'block' : 'none';
    }
    if (ui.pskGroup) {
      ui.pskGroup.style.display = isEnterprise ? 'none' : 'block';
    }
  }

  // Event Listeners Setup
  function initEvents() {
    if (ui.wmode) {
      ui.wmode.addEventListener('change', updateModeVisibility);
    }

    document.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        if (ui.knownKg && val) ui.knownKg.value = val;
      });
    });

    if (ui.btnTare) {
      ui.btnTare.addEventListener('click', async () => {
        ui.btnTare.disabled = true;
        try {
          const res = await apiCall('/api/tare', { method: 'POST' });
          if (!res) {
            showToast('Failed to tare: network error', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Tare failed', true);
            return;
          }
          showToast(res.message || 'Tare command issued', false);
        } catch (e) {
          showToast('Error issuing tare command', true);
        } finally {
          ui.btnTare.disabled = false;
          refreshStatus();
        }
      });
    }

    if (ui.btnCapturePoint) {
      ui.btnCapturePoint.addEventListener('click', async () => {
        const kg = parseFloat(ui.knownKg.value);
        if (isNaN(kg) || kg <= 0) {
          showToast('Please enter a valid positive test weight (kg)', true);
          return;
        }

        ui.btnCapturePoint.disabled = true;
        ui.btnCapturePoint.textContent = 'Capturing...';

        const data = await apiCall('/api/status');
        if (!data || data.raw === undefined) {
          showToast('Failed to read sensor data', true);
        } else {
          calibPoints.push({ weightKg: kg, rawCounts: data.raw, timestamp: Date.now() });
          updateRegression();
          renderCalibPoints();
          showToast(`Captured point ${calibPoints.length}: ${kg.toFixed(3)} kg @ ${Math.round(data.raw).toLocaleString()} counts`);
        }

        ui.btnCapturePoint.disabled = false;
        ui.btnCapturePoint.textContent = 'Capture Point';
      });
    }

    if (ui.btnApplyMulti) {
      ui.btnApplyMulti.addEventListener('click', async () => {
        if (!regression) return;

        ui.btnApplyMulti.disabled = true;
        ui.btnApplyMulti.textContent = 'Applying...';
        
        try {
          const url = `/api/calibrate/multi?slope=${encodeURIComponent(regression.slope)}&intercept=${encodeURIComponent(regression.intercept)}`;
          const res = await apiCall(url, { method: 'POST' });
          
          if (!res) {
            showToast('Failed to apply calibration: network error', true);
            return;
          }
          
          if (!res.ok) {
            showToast(res.message || 'Calibration failed', true);
            return;
          }
          
          showToast('Calibration applied, verifying...', false);
          
          await new Promise(r => setTimeout(r, 400));
          const status = await apiCall('/api/status');
          if (status && status.calibrated) {
            showToast('Calibration successfully applied and verified', false);
          } else {
            showToast('Warning: calibration may not have taken effect', true);
          }
        } catch (e) {
          showToast('Error applying calibration', true);
        } finally {
          ui.btnApplyMulti.disabled = false;
          ui.btnApplyMulti.textContent = 'Apply Calibration';
          refreshStatus();
        }
      });
    }

    if (ui.btnClearPoints) {
      ui.btnClearPoints.addEventListener('click', () => {
        calibPoints = [];
        regression = null;
        updateRegression();
        renderCalibPoints();
        showToast('All calibration points cleared');
      });
    }

    if (ui.btnResetTotals) {
      ui.btnResetTotals.addEventListener('click', async () => {
        if (!confirm('Reset current session cumulative totals?')) return;
        ui.btnResetTotals.disabled = true;
        try {
          const res = await apiCall('/api/totals/reset', { method: 'POST' });
          if (!res) {
            showToast('Failed to reset totals: network error', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Reset totals failed', true);
            return;
          }
          showToast(res.message || 'Session totals reset successfully', false);
        } catch (e) {
          showToast('Error resetting totals', true);
        } finally {
          ui.btnResetTotals.disabled = false;
          refreshStatus();
        }
      });
    }

    if (ui.wifiForm) {
      ui.wifiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = ui.wmode.value;
        const ssid = encodeURIComponent(ui.ssid.value.trim());
        const psk = encodeURIComponent(ui.psk.value);
        const eid = encodeURIComponent(ui.eid.value.trim());
        const eusr = encodeURIComponent(ui.eusr.value.trim());
        const epwd = encodeURIComponent(ui.epwd.value);

        const body = `mode=${mode}&ssid=${ssid}&psk=${psk}&eid=${eid}&eusr=${eusr}&epwd=${epwd}`;

        const res = await apiCall('/api/wifi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        });

        if (res && res.message) {
          showToast(res.message);
        } else {
          showToast('WiFi settings saved. Reconnecting...');
        }
        setTimeout(refreshStatus, 1500);
      });
    }

    if (ui.btnForgetWifi) {
      ui.btnForgetWifi.addEventListener('click', async () => {
        if (!confirm('Forget uplink WiFi and operate in soft-AP setup mode?')) return;
        ui.btnForgetWifi.disabled = true;
        try {
          const res = await apiCall('/api/portal/force', { method: 'POST' });
          if (!res) {
            showToast('Failed to forget WiFi: network error', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Forget WiFi failed', true);
            return;
          }
          showToast(res.message || 'Uplink credentials cleared.', false);
        } catch (e) {
          showToast('Error forgetting WiFi', true);
        } finally {
          ui.btnForgetWifi.disabled = false;
          setTimeout(refreshStatus, 1000);
        }
      });
    }

    if (ui.btnFactoryReset) {
      ui.btnFactoryReset.addEventListener('click', async () => {
        const msg = 'WARNING: This will permanently erase ALL calibration, WiFi, and device settings in NVS flash.\n\nAre you sure you want to proceed?';
        if (!confirm(msg)) return;

        ui.btnFactoryReset.disabled = true;
        try {
          const res = await apiCall('/api/factory', { method: 'POST' });
          if (!res) {
            showToast('Failed to factory reset: network error', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Factory reset failed', true);
            return;
          }
          showToast(res.message || 'Transmitter factory reset complete.', false);
        } catch (e) {
          showToast('Error during factory reset', true);
        } finally {
          ui.btnFactoryReset.disabled = false;
          setTimeout(() => window.location.reload(), 2000);
        }
      });
    }
  }

  // Initialization
  window.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadConfig();
    refreshStatus();
    setInterval(refreshStatus, 500);
  });
})();
