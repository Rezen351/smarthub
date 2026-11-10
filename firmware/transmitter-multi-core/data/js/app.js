/**
 * E-Tani Smart Hub - Weight Transmitter Client Application
 * Communicates with ESP32 WebPortal endpoints via JSON API.
 */

(() => {
  const el = (id) => document.getElementById(id);

  const ui = {
    barUptime: el('barUptime'),
    barFw: el('barFw'),
    barTransport: el('barTransport'),
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

    transportForm: el('networkForm'),
    transportMode: el('transportMode'),
    wifiFields: el('wifiFields'),
    ethernetFields: el('ethernetFields'),
    wifiMode: el('wifiMode'),
    w5500Dhcp: el('w5500Dhcp'),
    w5500StaticIp: el('w5500StaticIp'),
    w5500StaticGateway: el('w5500StaticGateway'),
    w5500StaticSubnet: el('w5500StaticSubnet'),
    w5500StaticDns: el('w5500StaticDns'),
    btnSaveNetwork: el('btnSaveNetwork'),

    valTransportMode: el('valTransportMode'),
    valEthernetStatus: el('valEthernetStatus'),
    valEthernetIp: el('valEthernetIp'),

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
    wifiMode: el('wifiMode'),
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
          saveCalibPointsToStorage();
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

  function isValidIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
      const n = Number(parts[i]);
      if (!Number.isInteger(n) || n < 0 || n > 255) return false;
    }
    return true;
  }

  function validateNetworkForm() {
    const useDhcp = ui.w5500Dhcp ? ui.w5500Dhcp.value === 'false' : false;
    if (useDhcp) return true;
    const ip = ui.w5500StaticIp ? ui.w5500StaticIp.value.trim() : '';
    const gw = ui.w5500StaticGateway ? ui.w5500StaticGateway.value.trim() : '';
    const sn = ui.w5500StaticSubnet ? ui.w5500StaticSubnet.value.trim() : '';
    const dns = ui.w5500StaticDns ? ui.w5500StaticDns.value.trim() : '';
    if (!isValidIp(ip)) {
      showToast('Invalid static IP address. Use format: 192.168.1.100', true);
      return false;
    }
    if (!isValidIp(gw)) {
      showToast('Invalid gateway. Use format: 192.168.1.1', true);
      return false;
    }
    if (!isValidIp(sn)) {
      showToast('Invalid subnet mask. Use format: 255.255.255.0', true);
      return false;
    }
    if (!isValidIp(dns)) {
      showToast('Invalid DNS server. Use format: 8.8.8.8', true);
      return false;
    }
    return true;
  }

  function setNetworkFormDisabled(disabled) {
    if (!ui.transportForm) return;
    const inputs = ui.transportForm.querySelectorAll('input, select, button');
    inputs.forEach(el => { el.disabled = disabled; });
    if (ui.btnSaveNetwork) {
      ui.btnSaveNetwork.disabled = disabled;
      ui.btnSaveNetwork.textContent = disabled ? 'Saving...' : 'Save Configuration';
    }
  }

  function updateTransportStateUI(state) {
    setNetworkFormDisabled(state === 'switching');
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

    const transport = data.transport || {};
    const modeName = transport.modeName || 'WiFi';

    if (ui.barTransport) {
      const short = modeName === 'Ethernet' ? 'ETH' : 'WI';
      ui.barTransport.textContent = short;
      ui.barTransport.className = 'badge ' + (modeName === 'Ethernet' ? 'badge-ok' : 'badge-neutral');
    }

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

    if (ui.valTransportMode) {
      const state = transport.state || 'unknown';
      let stateLabel = '';
      if (modeName === 'Ethernet') {
        if (state === 'active') stateLabel = 'Active';
        else if (state === 'switching') stateLabel = 'Applying...';
        else if (state === 'failed') stateLabel = 'Failed';
        else stateLabel = 'Inactive';
      } else {
        stateLabel = 'WiFi';
      }
      ui.valTransportMode.textContent = stateLabel;
      ui.valTransportMode.style.color =
        state === 'failed' ? 'var(--danger)' :
        state === 'active' ? 'var(--status-ok)' :
        modeName === 'Ethernet' ? 'var(--text-secondary)' : 'var(--text)';
    }

    if (ui.valEthernetStatus) {
      const ethActive = transport.ethernetActive;
      const state = transport.state || 'unknown';
      let statusText = 'Inactive';
      let statusColor = 'var(--text-muted)';
      if (modeName === 'Ethernet') {
        if (state === 'active') { statusText = 'Active'; statusColor = 'var(--status-ok)'; }
        else if (state === 'switching') { statusText = 'Applying...'; statusColor = 'var(--warning)'; }
        else if (state === 'failed') { statusText = 'Failed'; statusColor = 'var(--danger)'; }
        else { statusText = 'Inactive'; statusColor = 'var(--text-muted)'; }
      }
      ui.valEthernetStatus.textContent = statusText;
      ui.valEthernetStatus.style.color = statusColor;
    }

    if (ui.valEthernetIp) {
      const ip = transport.ethernetIp || '--';
      ui.valEthernetIp.textContent = ip;
      if (transport.state === 'failed') {
        ui.valEthernetIp.style.color = 'var(--danger)';
      } else if (transport.ethernetActive) {
        ui.valEthernetIp.style.color = 'var(--status-ok)';
      } else {
        ui.valEthernetIp.style.color = 'var(--text)';
      }
    }

    updateTransportStateUI(transport.state || 'unknown');
  }

  async function loadConfig() {
    const cfg = await apiCall('/api/config');
    if (!cfg) return;

    if (ui.wifiMode) ui.wifiMode.value = String(cfg.wifiMode || 0);
    if (ui.ssid) ui.ssid.value = cfg.ssid || '';
    if (ui.psk) ui.psk.value = cfg.wpaPassword || '';
    if (ui.eid) ui.eid.value = cfg.entIdentity || '';
    if (ui.eusr) ui.eusr.value = cfg.entUsername || '';
    if (ui.epwd) ui.epwd.value = cfg.entPassword || '';

    if (ui.transportMode) {
      const modeVal = String(cfg.transportMode || 0);
      const radio = document.querySelector(`input[name="transportMode"][value="${modeVal}"]`);
      if (radio) radio.checked = true;
      updateTransportVisibility();
    }

    if (ui.w5500Dhcp) ui.w5500Dhcp.value = cfg.w5500UseDhcp ? 'true' : 'false';
    if (ui.w5500StaticIp) ui.w5500StaticIp.value = cfg.w5500StaticIp || '';
    if (ui.w5500StaticGateway) ui.w5500StaticGateway.value = cfg.w5500StaticGateway || '';
    if (ui.w5500StaticSubnet) ui.w5500StaticSubnet.value = cfg.w5500StaticSubnet || '';
    if (ui.w5500StaticDns) ui.w5500StaticDns.value = cfg.w5500StaticDns || '';

    updateModeVisibility();
  }

  function updateTransportVisibility() {
    const selected = document.querySelector('input[name="transportMode"]:checked');
    const isEthernet = selected && selected.value === '1';
    if (ui.wifiFields) {
      ui.wifiFields.style.display = isEthernet ? 'none' : 'block';
    }
    if (ui.ethernetFields) {
      ui.ethernetFields.style.display = isEthernet ? 'block' : 'none';
    }
  }

  function updateModeVisibility() {
    const mode = ui.wifiMode ? ui.wifiMode.value : '0';
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
    if (ui.wifiMode) {
      ui.wifiMode.addEventListener('change', updateModeVisibility);
    }

    document.querySelectorAll('input[name="transportMode"]').forEach(radio => {
      radio.addEventListener('change', updateTransportVisibility);
    });

    if (ui.transportForm) {
      ui.transportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateNetworkForm()) return;

        const transportMode = document.querySelector('input[name="transportMode"]:checked')?.value || '0';
        const wifiMode = ui.wifiMode ? ui.wifiMode.value : '0';
        const ssid = encodeURIComponent(ui.ssid.value.trim());
        const psk  = encodeURIComponent(ui.psk.value);
        const eid  = encodeURIComponent(ui.eid.value.trim());
        const eusr = encodeURIComponent(ui.eusr.value.trim());
        const epwd = encodeURIComponent(ui.epwd.value);
        const w5500UseDhcp = ui.w5500Dhcp ? ui.w5500Dhcp.value : 'true';
        const w5500StaticIp = encodeURIComponent(ui.w5500StaticIp.value.trim());
        const w5500StaticGateway = encodeURIComponent(ui.w5500StaticGateway.value.trim());
        const w5500StaticSubnet = encodeURIComponent(ui.w5500StaticSubnet.value.trim());
        const w5500StaticDns = encodeURIComponent(ui.w5500StaticDns.value.trim());

        const body = `transportMode=${transportMode}&wifiMode=${wifiMode}&ssid=${ssid}&psk=${psk}&eid=${eid}&eusr=${eusr}&epwd=${epwd}&w5500UseDhcp=${w5500UseDhcp}&w5500StaticIp=${w5500StaticIp}&w5500StaticGateway=${w5500StaticGateway}&w5500StaticSubnet=${w5500StaticSubnet}&w5500StaticDns=${w5500StaticDns}`;

        setBusy(ui.btnSaveNetwork, true, 'Saving...', 'Save Configuration');

        try {
          const res = await apiCall('/api/network/config', {
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

          showToast(res.message || 'Network configuration saved.', false);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await refreshStatus();
        } catch (err) {
          showToast('Error applying network configuration', true);
        } finally {
          setBusy(ui.btnSaveNetwork, false, 'Saving...', 'Save Configuration');
        }
      });
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
          saveCalibPointsToStorage();
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
        saveCalibPointsToStorage();
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

        const mode = ui.wifiMode.value;
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
    if (data && data.ok && Array.isArray(data.data.points) && data.data.points.length > 0) {
      calibPoints = data.data.points.map(p => ({ weightKg: p.kg, rawCounts: p.counts, timestamp: Date.now() }));
    } else {
      const stored = localStorage.getItem('calibPoints');
      if (stored) {
        try {
          calibPoints = JSON.parse(stored);
        } catch (e) {
          calibPoints = [];
        }
      } else {
        calibPoints = [];
      }
    }
    updateAverage();
    renderCalibPoints();
  }

  function saveCalibPointsToStorage() {
    try {
      localStorage.setItem('calibPoints', JSON.stringify(calibPoints));
    } catch (e) {
      // ignore storage errors
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
