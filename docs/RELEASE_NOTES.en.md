# Growatt Open API Release Notes

## 2026-09-09

### Global Parameters

| Update | Affected APIs | Type |
|--------|--------------|------|
| Added detailed descriptions for `type` field modes in `duration_and_power_charge_discharge` parameter (see 10_global_params) | / | documentation |

---

## 2026-08-14

### Device Information

| Update | Affected APIs | Type |
|--------|---------------|------|
| Added `systemId` field for site identification | `getDeviceInfo` | enhancement |

### Device Dispatch

| Update | Affected APIs | Type |
|--------|---------------|------|
| Documented `duration_and_power_charge_discharge` parameter field specifications | `deviceDispatch` | documentation |

---

## 2026-07-27

### Device Data

| Update | Affected APIs | Type |
|--------|---------------|------|
| Removed `smartLoadPower` field | `getDeviceData` | fix |

### Product Support

| Update | Affected APIs | Type |
|--------|---------------|------|
| Updated supported inverter/PCE model list | / | documentation |

### Rate Limiting

| Update | Affected APIs | Type |
|--------|---------------|------|
| Published API rate-limiting rules | All APIs | documentation |

---

## 2026-07-17

### Device Information

| Update | Affected APIs | Type |
|--------|---------------|------|
| Added site metadata fields: `siteName`, `latitude`, `longitude`, `timezone`, `dischargeCutOffSOC`, `backupCutOffSOC` | `getDeviceInfo` | enhancement |

### Device Data

| Update | Affected APIs | Type |
|--------|---------------|------|
| Added `maxChargePower`, `maxDischargePower`, `epvToday` fields | `getDeviceData` | enhancement |

---

## 2026-04-24

### Documentation

| Update | Affected APIs | Type |
|--------|---------------|------|
| Initial public release of Growatt Open API documentation | All APIs | new |
