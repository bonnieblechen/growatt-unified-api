# 设备运行模式查询 API

## 简要描述

- 根据设备序列号查询设备当前的电池运行模式。
- 接口仅返回当前 token 有权限访问的设备查询结果；无权限设备会返回 `DEVICE_SN_DOES_NOT_HAVE_PERMISSION`。
- 该接口专为 VPP 聚合商设计，用于监控电池调度状态，以支持需求响应和能源优化场景。
- 请求频率上限：`1 request / min / device`。

## 请求 URL

- `/oauth2/getDeviceOperationMode`

## 请求方式

- `POST`
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

## HTTP 头部参数及说明

| 参数名 | 必选 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `Authorization` | 是 | string | 密钥令牌 | `Bearer ACCESS_TOKEN` |

## HTTP Body 参数及说明

| 参数名 | 必选 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `deviceSn` | 是 | string | 设备唯一序列号（SN） | `"PGP0A12367"` |
| `setType` | 是 | string | 请求类型 | `"duration_and_power_charge_discharge"` |
| `requestId` | 是 | string | 唯一请求标识符 | `"20260806180530123abcdef123456789"` |

## 接口返回参数和说明

| 参数名 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `code` | int | 接口返回状态码，`0` 成功，其余失败 | `0` |
| `data` | string | 当前电池运行模式值 | `"IMPORT_FOCUS"` |
| `message` | string | 返回说明 | `"SUCCESSFUL_OPERATION"` |

## 运行模式取值说明

| 取值 | 业务含义 | 典型应用场景 |
| :--- | :--- | :--- |
| `SELF_RELIANCE` | 自给自足模式：优先使用太阳能或电池满足家庭用电，减少对电网的依赖 | 自发自用优化、降低电网购电 |
| `TIME_OF_USE` | 分时电价模式：电池、太阳能、电网的使用遵循用户定义的分时电价计划 | 基于峰谷电价的成本优化 |
| `IMPORT_FOCUS` | 优先充电模式：优先给电池充电，使用多余太阳能或电网电力（如已配置） | 低价时段充电、事件前备电 |
| `EXPORT_FOCUS` | 优先放电模式：优先放电给家庭负载，多余能量可向电网输出（如允许） | VPP 调度、需求响应、削峰填谷 |
| `IDLE` | 待机模式：阻止电池充放电，保持当前电量（SoC） | 电池保护、锁定 SoC、策略切换过渡 |

## 请求示例

```json
{
  "deviceSn": "PGP0A12367",
  "setType": "duration_and_power_charge_discharge",
  "requestId": "${__time(yyyyMMddHmmssSSS)}${__RandomString(15,15)}"
}
```

## 返回示例

```json
{
  "code": 0,
  "data": "IMPORT_FOCUS",
  "message": "SUCCESSFUL_OPERATION"
}
```

## 客户端实现指南

1. **轮询频率**：遵守 `1 request / min / device` 频率限制，避免触发 `TOO_MANY_REQUEST` 错误。
2. **设备授权**：查询前需通过[设备授权 API](./04_api_device_auth.md) 完成设备授权。
3. **模式解读**：根据 `operationMode` 取值理解当前电池调度状态，调整 VPP 调度逻辑。
4. **离线处理**：若设备返回 `DEVICE_OFFLINE`，建议实现指数退避重试策略。

## 相关文档

- [设备数据查询 API](./08_api_device_data.md) - 查询设备实时遥测数据
- [设备控制 API](./05_api_device_dispatch.md) - 向设备发送控制指令
- [设备授权 API](./04_api_device_auth.md) - 授权设备供 API 访问
- [储能系统术语表](./13_ess_terminology.md) - 储能系统相关术语
