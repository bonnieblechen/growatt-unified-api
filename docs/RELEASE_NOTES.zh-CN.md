# Growatt Open API Release Notes

## 2026-09-24

### 全局参数

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 补充古瑞瓦特当前使用的响应错误码 | / | 文档完善 |

### 历史数据

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 更新 `getDeviceEnergyData` 和 `getDeviceDailyDetail` 的响应结构示例 | `getDeviceEnergyData`、`getDeviceDailyDetail` | 文档完善 |

---

## 2026-09-11

### 历史数据

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增历史数据查询接口，支持按月查询逐日能量统计和单日采样明细 | `HistoricalData` | 新增接口 |

### 设备信息

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增 `siteAddress` 和 `installationDate` 字段 | `getDeviceInfo` | 新增字段 |

### 设备数据

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| SPH 机型现已支持 `maxChargePower` 和 `maxDischargePower` 字段 | `getDeviceData`、推送报文 | 字段支持扩展 |

---

## 2026-09-09

### 全局参数

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增 `duration_and_power_charge_discharge` 参数的 `type` 字段各模式详细说明（见 10_global_params） | / | 文档完善 |

---

## 2026-08-14

### 设备信息

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增 `systemId` 字段用于站点识别 | `getDeviceInfo` | 功能增强 |

### 设备调度

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 补充 `duration_and_power_charge_discharge` 参数字段说明 | `deviceDispatch` | 文档完善 |

---

## 2026-07-27

### 设备数据

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 移除 `smartLoadPower` 字段 | `getDeviceData` | 修复 |

### 产品支持

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 更新支持的逆变器/PCE 机型列表 | / | 文档完善 |

### 频率限制

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 发布 API 频率限制规则 | 所有 API | 文档完善 |

---

## 2026-07-17

### 设备信息

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增站点元数据字段：`siteName`、`latitude`、`longitude`、`timezone`、`dischargeCutOffSOC`、`backupCutOffSOC` | `getDeviceInfo` | 功能增强 |

### 设备数据

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| 新增 `maxChargePower`、`maxDischargePower`、`epvToday` 字段 | `getDeviceData` | 功能增强 |

---

## 2026-04-24

### 文档

| 更新内容 | 受影响的 API | 类型 |
|---------|-------------|------|
| Growatt Open API 文档首次公开发布 | 所有 API | 新增 |
