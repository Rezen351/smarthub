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
    btnSaveWifi: el('btnSaveWifi'),

    rebootOverlay: el('rebootOverlay'),
    rebootMessage: el('rebootMessage'),

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
  let avgCalibration = null;
  let pollingPaused = false;    // true while a restart is expected
  let statusInFlight = false;   // prevents overlapping /api/status polls

  // Every request is bounded so a stalled radio can never freeze the UI.
  const API_TIMEOUT_MS = 4000;

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

  function setBusy(button, busy, busyLabel, idleLabel) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
  }

  function showRebootOverlay(message) {
    if (!ui.rebootOverlay) return;
    if (ui.rebootMessage && message) ui.rebootMessage.textContent = message;
    ui.rebootOverlay.classList.add('reboot-overlay-visible');
  }

  function hideRebootOverlay() {
    if (!ui.rebootOverlay) return;
    ui.rebootOverlay.classList.remove('reboot-overlay-visible');
  }

  async function apiCall(endpoint, options = {}) {
    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;

    try {
      const requestOptions = Object.assign({
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      }, options);
      if (controller && !requestOptions.signal) requestOptions.signal = controller.signal;

      const response = await fetch(endpoint, requestOptions);
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`[API] Error contacting ${endpoint}:`, err);
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Polls the transmitter until it answers again after a restart.
  async function waitForDeviceOnline(timeoutMs = 30000) {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const data = await apiCall('/api/status');
      if (data && typeof data.uptime === 'number' && data.rebooting !== true) {
        return true;
      }
    }
    return false;
  }

  // Shared post-restart flow: overlay -> wait -> reload the SPA.
  async function handleRebootFlow() {
    pollingPaused = true;
    showRebootOverlay('Applying changes and restarting the transmitter...');

    const online = await waitForDeviceOnline();
    if (online) {
      showRebootOverlay('Transmitter is back online. Reloading...');
      await new Promise((resolve) => setTimeout(resolve, 800));
      window.location.reload();
      return true;
    }

    pollingPaused = false;
    hideRebootOverlay();
    showToast('Transmitter did not come back within 30 s. Reconnect to its WiFi and reload.', true);
    return false;
  }

  function formatGramsToKg(g) {
    return ((g || 0) / 1000.0).toFixed(3);
  }

  function computeAverage(points) {
    const n = points.length;
    if (n < 1) return null;

    let sumRatio = 0;
    let minRaw = Infinity;
    let maxRaw = -Infinity;
    for (const p of points) {
      const ratio = p.weightKg > 0 ? p.rawCounts / p.weightKg : 0;
      sumRatio += ratio;
      if (p.rawCounts < minRaw) minRaw = p.rawCounts;
      if (p.rawCounts > maxRaw) maxRaw = p.rawCounts;
    }

    return {
      countsPerKg: sumRatio / n,
      n,
      minRaw: minRaw === Infinity ? 0 : minRaw,
      maxRaw: maxRaw === -Infinity ? 0 : maxRaw
    };
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
          updateAverage();
          renderCalibPoints();
        });
      });
    }

    if (ui.btnClearPoints) {
      ui.btnClearPoints.disabled = calibPoints.length === 0;
    }
  }

  function updateAverage() {
    avgCalibration = computeAverage(calibPoints);

    if (avgCalibration && ui.regressionResults) {
      ui.regressionResults.style.display = 'grid';
      if (ui.valSlope) ui.valSlope.textContent = avgCalibration.countsPerKg.toFixed(1);
      if (ui.valIntercept) ui.valIntercept.textContent = String(avgCalibration.n);
      if (ui.valR2) ui.valR2.textContent = Math.round(avgCalibration.minRaw).toLocaleString();
      if (ui.valStdErr) ui.valStdErr.textContent = Math.round(avgCalibration.maxRaw).toLocaleString();
    } else if (ui.regressionResults) {
      ui.regressionResults.style.display = 'none';
    }

    if (ui.btnApplyMulti) {
      ui.btnApplyMulti.disabled = !avgCalibration || calibPoints.length < 1;
    }
  }

  // Update Live Telemetry
  async function refreshStatus() {
    if (pollingPaused || statusInFlight) return;
    statusInFlight = true;
    try {
      const data = await apiCall('/api/status');
      if (!data) {
        if (ui.barIp) ui.barIp.textContent = 'Disconnected';
        return;
      }
      applyStatus(data);
    } finally {
      statusInFlight = false;
    }
  }

  function applyStatus(data) {
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
          updateAverage();
          renderCalibPoints();
          showToast(`Captured point ${calibPoints.length}: ${kg.toFixed(3)} kg @ ${Math.round(data.raw).toLocaleString()} counts`);
        }

        ui.btnCapturePoint.disabled = false;
        ui.btnCapturePoint.textContent = 'Capture Point';
      });
    }

    if (ui.btnApplyMulti) {
      ui.btnApplyMulti.addEventListener('click', async () => {
        const avg = computeAverage(calibPoints);
        if (!avg) return;

        setBusy(ui.btnApplyMulti, true, 'Applying...', 'Apply Calibration');

        try {
          const url = `/api/calibrate/multi?slope=${encodeURIComponent(avg.countsPerKg.toFixed(4))}`;
          const res = await apiCall(url, { method: 'POST' });

          if (!res) {
            showToast('Failed to apply calibration: no response from the transmitter', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Calibration failed', true);
            return;
          }

          // Calibration is stored in NVS and the transmitter restarts, so wait
          // for it to come back and then reload the page with fresh values.
          showToast(res.message || 'Calibration saved. Device is rebooting...', false);
          await handleRebootFlow();
        } catch (e) {
          showToast('Error applying calibration', true);
        } finally {
          setBusy(ui.btnApplyMulti, false, 'Applying...', 'Apply Calibration');
        }
      });
    }

    if (ui.btnClearPoints) {
      ui.btnClearPoints.addEventListener('click', () => {
        calibPoints = [];
        avgCalibration = null;
        updateAverage();
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
        const psk  = encodeURIComponent(ui.psk.value);
        const eid  = encodeURIComponent(ui.eid.value.trim());
        const eusr = encodeURIComponent(ui.eusr.value.trim());
        const epwd = encodeURIComponent(ui.epwd.value);
        const body = `mode=${mode}&ssid=${ssid}&psk=${psk}&eid=${eid}&eusr=${eusr}&epwd=${epwd}`;

        setBusy(ui.btnSaveWifi, true, 'Applying...', 'Apply Configuration');

        try {
          const res = await apiCall('/api/wifi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
          });

          if (!res) {
            showToast('No response from the transmitter. Retry in a few seconds.', true);
            return;
          }
          if (!res.ok) {
            showToast(res.message || 'Configuration rejected', true);
            return;
          }

          showToast(res.message || 'Configuration saved. Uplink is being applied...', false);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await refreshStatus();
        } catch (err) {
          showToast('Error applying configuration', true);
        } finally {
          setBusy(ui.btnSaveWifi, false, 'Applying...', 'Apply Configuration');
        }
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
          await handleRebootFlow();
        } catch (e) {
          showToast('Error forgetting WiFi', true);
        } finally {
          ui.btnForgetWifi.disabled = false;
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
          await handleRebootFlow();
        } catch (e) {
          showToast('Error during factory reset', true);
        } finally {
          ui.btnFactoryReset.disabled = false;
        }
      });
    }
  }

  async function loadCalibrationPoints() {
    const data = await apiCall('/api/calibration/points');
    if (data && data.ok && Array.isArray(data.data.points)) {
      calibPoints = data.data.points.map(p => ({ weightKg: p.kg, rawCounts: p.counts, timestamp: Date.now() }));
      updateAverage();
      renderCalibPoints();
    }
  }

  // Initialization
  window.addEventListener('DOMContentLoaded', async () => {
    initEvents();
    loadConfig();
    await loadCalibrationPoints();
    refreshStatus();
    setInterval(refreshStatus, 500);
  });
})();
