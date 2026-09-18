import XLSX from 'xlsx';

// 一、认证授权类 - 详细版
const authSheet = [
  ['API 接口', '功能说明', '请求参数', '返回参数', '备注'],
  ['/oauth2/token', '获取访问令牌', 'grant_type（必填）\ncode（授权码模式必填）\nclient_id（必填）\nclient_secret（必填）\nredirect_uri（必填）', 'access_token\nrefresh_token（授权码模式返回）\nrefresh_expires_in\ntoken_type\nexpires_in', '支持 authorization_code 和 client_credentials 两种模式'],
  ['/oauth2/refresh', '刷新访问令牌', 'grant_type（必填，值为 refresh_token）\nrefresh_token（必填）\nclient_id（必填）\nclient_secret（必填）', 'access_token\nrefresh_token\nrefresh_expires_in\ntoken_type\nexpires_in', '使用旧 refresh_token 换取新的 token 对'],
  ['/oauth2/getDeviceList', '获取可授权设备列表', '无参数', 'data[].deviceSn\ndata[].deviceTypeName\ndata[].model\ndata[].nominalPower\ndata[].datalogSn\ndata[].dtc\ndata[].communicationVersion\ndata[].authFlag', '仅 authorization_code 模式支持'],
  ['/oauth2/bindDevice', '授权设备', 'deviceSnList[].deviceSn（必填）\ndeviceSnList[].pinCode（客户端模式必填）', 'code（状态码）\nmessage\ndata（可能包含无权限的设备SN列表）', '支持批量授权'],
  ['/oauth2/getDeviceListAuthed', '获取已授权设备列表', '无参数', 'data[].deviceSn\ndata[].deviceTypeName\ndata[].model\ndata[].nominalPower\ndata[].datalogSn\ndata[].dtc\ndata[].communicationVersion\ndata[].authFlag', '返回已授权给当前平台的设备'],
  ['/oauth2/unbindDevice', '解除设备授权', 'deviceSnList[]（字符串数组）', 'code（状态码）\nmessage\ndata（null）', '支持批量解绑']
];

// 二、设备信息查询类
const deviceInfoSheet = [
  ['API 接口', '功能说明', '请求参数', '信息分类', '返回字段'],
  ['/oauth2/getDeviceInfo', '查询设备静态信息', 'deviceSn（必填）', '设备信息', 'deviceSn, model, deviceTypeName, nominalPower, dtc, communicationVersion, unifiedAPIver, deviceVersion'],
  ['', '', '', '采集器信息', 'datalogSn, datalogDeviceTypeName, datalogVersion'],
  ['', '', '', '电池信息', 'existBattery, batterySn, batteryModel, batteryCapacity, batteryNominalPower, batteryList[], dischargeCutOffSOC, backupCutOffSOC'],
  ['', '', '', '电站信息', 'systemId（电站全局唯一标识）, siteName, latitude, longitude, timezone'],
  ['', '', '', '授权状态', 'authFlag'],
  ['', '', '', '电池列表', 'batteryList[].batterySn, batteryList[].batteryModel, batteryList[].batteryCapacity, batteryList[].batteryNominalPower']
];

// 三、设备数据查询类
const deviceDataSheet = [
  ['API 接口', '功能说明', '请求参数', '数据分类', '返回字段'],
  ['/oauth2/getDeviceData', '查询设备实时遥测数据', 'deviceSn（必填）', '基础信息', 'deviceSn（设备序列号）, utcTime（UTC时间戳，格式 yyyy-MM-dd HH:mm:ss）'],
  ['', '', '', '电网参数', 'fac（频率 Hz）, vac1/vac2/vac3（三相电压 V）, reactivePower（无功功率，正值容性、负值感性）'],
  ['', '', '', '功率数据', 'pac（交流输出功率 W）, batPower（电池功率 W，正充负放）, meterPower（电表功率 W，正取负馈）, pexPower（外部发电功率 W）, genPower（发电机功率 W）, ppv（PV功率 W）, payLoadPower（负载功率 W）, backupPower（备用输出功率 W）'],
  ['', '', '', '电池参数', 'soc（系统级荷电状态 %）, maxChargePower（最大充电功率 W）, maxDischargePower（最大放电功率 W）, batteryStatus（电池状态码）'],
  ['', '', '', '能量数据', 'etoUserToday（今日取电 kWh）, etoUserTotal（总取电 kWh）, etoGridToday（今日馈电 kWh）, etoGridTotal（总馈电 kWh）, epvToday（PV今日发电 kWh）, epvTotal（PV总发电 kWh）'],
  ['', '', '', '状态信息', 'status（运行状态码）, priority（工作优先级）, faultCode（故障主码）, faultSubCode（故障子码）, protectCode（保护主码）, protectSubCode（保护子码）'],
  ['', '', '', '电池列表详细', 'batteryList[].index（电池索引）, soc（SOC %）, chargePower（充电功率 W）, dischargePower（放电功率 W）, vbat（电压 V）, ibat（电流 A）, soh（健康状态 %）, status（状态码）, echargeToday/Total（充电量 kWh）, edischargeToday/Total（放电量 kWh）'],
  ['', '', '', '', ''],
  ['/oauth2/getDeviceOperationMode', '查询设备电池运行模式', 'deviceSn（必填）\nsetType（必填，固定值：duration_and_power_charge_discharge）\nrequestId（必填）', '运行模式枚举', 'data: 字符串类型，返回当前运行模式\n可能值：\n- SELF_RELIANCE（自给自足）\n- TIME_OF_USE（分时电价）\n- IMPORT_FOCUS（优先充电）\n- EXPORT_FOCUS（优先放电）\n- IDLE（待机）'],
  ['', '', '', '', ''],
  ['/oauth2/getDeviceEnergyData (DeviceHistoricalData)', '查询设备历史统计数据（按日/月）', 'deviceSn（必填）\nlevel（必填：Day / Month）\ndate（必填，格式 yyyy-MM-dd）', '历史统计数据', 'data.list[].date（日期 yyyy-MM-dd）\ndata.list[].epv（当日PV发电量 kWh）\ndata.list[].etoUser（当日电网取电量 kWh）\ndata.list[].etoGrid（当日电网送电量 kWh）\ndata.list[].echarge（当日电池充电量 kWh）\ndata.list[].edischarge（当日电池放电量 kWh）\n\nlevel=Day: 返回单日统计\nlevel=Month: 返回整月逐日序列\n缺数天保留 date，电量字段返回 null'],
  ['/oauth2/getDeviceDailyDetail (DeviceDailyDetail)', '查询设备单日明细采样序列', 'deviceSn（必填）\ndate（必填，格式 yyyy-MM-dd）', '单日明细采样', '返回该日所有采样点，每笔包含完整遥测字段（与 getDeviceData 一致）：\nutcTime, ppv, pac, payLoadPower, batPower, soc, status, batteryStatus, priority, faultCode, protectCode, reactivePower, fac, meterPower, etoUserToday, etoUserTotal, etoGridToday, etoGridTotal, epvToday, epvTotal, pexPower, vac1/2/3, maxChargePower, maxDischargePower, batteryList[]\n按 utcTime 升序排列']
];

// 四、设备数据推送类
const pushSheet = [
  ['API 接口', '功能说明', '数据结构', '推送内容'],
  ['Webhook 推送', '向第三方平台主动推送设备数据', 'dataType: "dfcData"\ndata: {...}', '推送的 data 字段内容与 /oauth2/getDeviceData 返回的 data 结构完全一致，包含所有遥测点']
];

// 五、设备调度控制类
const dispatchSheet = [
  ['API 接口', '功能说明', '请求参数', '返回参数', '支持的指令类型'],
  ['/oauth2/deviceDispatch', '下发控制指令', 'deviceSn（必填）\nsetType（必填）\nvalue（必填，结构随 setType 变化）\nrequestId（必填，32位唯一标识）', 'code（状态码）\nmessage\ndata（null）', '见"调度指令详细"工作表的 7 种 setType'],
  ['/oauth2/readDeviceDispatch', '回读调度参数', 'deviceSn（必填）\nsetType（必填）\nrequestId（必填，32位唯一标识）', 'code（状态码）\nmessage\ndata（结构随 setType 变化：数组/对象/数值）', '读取所有 setType 对应的当前设置值']
];

// 六、调度指令详细分类
const setTypeSheet = [
  ['setType', '指令名称', '控制内容', 'value 下发结构', 'readDeviceDispatch 回读结构', '说明'],
  ['time_slot_charge_discharge', '分时段充放电', '设置多个时间段的充放电计划', '数组：[{percentage, startTime, endTime}]', '数组：[{percentage, startTime, endTime}]', 'percentage 范围 [-100,100]，正充负放；时间为 UTC；最多16个时段'],
  ['duration_and_power_charge_discharge', '按时长与功率充放电', '设置充放电时长、功率和模式', '对象：{duration, percentage, type}', '对象：{remotePowerControlEnable, duration, percentage, acChargingEnabled}\n注意：回读时会额外返回 remotePowerControlEnable 和 acChargingEnabled', 'duration: 0~1440分钟\npercentage: [-100,100]\ntype: 见"充放电指令类型"表'],
  ['export_limit', '防逆流控制', '控制逆流/顺流限制', '对象：{exportLimitEnabled, percentage}', '对象：{exportLimitEnabled, percentage}', 'exportLimitEnabled: 1=启用, 0=关闭\npercentage: [-100,100]，正值逆流限制、负值顺流控制'],
  ['enable_control', 'VPP 控制开关', '启用/关闭 VPP 控制', '数值：1 或 0', '数值：1 或 0', '1=开启，0=关闭'],
  ['active_power_derating_percentage', '有功功率降额', '设置有功功率降额百分比', '数值：[0,100]', '数值：[0,100]', '例如 50 表示降额到 50%'],
  ['active_power_percentage', '有功功率百分比', '设置有功功率输出百分比', '数值：[0,100]', '数值：[0,100]', '例如 60 表示输出 60%'],
  ['remote_charge_discharge_power', '远程充放电功率', '设置远程充放电功率', '数值：[-100,100]', '数值：[-100,100]', '正值充电、负值放电']
];

// 七、时长功率充放电指令类型
const typeSheet = [
  ['type 值', '指令名称', '功能说明', '功率控制特点', '适用场景'],
  ['selfConsumptionCommand', '自发自用模式', '光伏优先供负载，余量充电；不足时电池放电或从电网取电', '系统自动控制最大功率，percentage 参数无效', '一般的自发自用场景'],
  ['chargeOnlySelfConsumptionCommand', '只充不放自发自用', '光伏充足时充电，光伏不足时电池不充不放，负载从市电取电', '系统自动控制最大功率，percentage 参数无效', '仅允许光伏充电的场景'],
  ['chargeCommand', '强制充电', '从可用电源（光伏和/或市电）以指定功率充电', '遵循 percentage 设定', 'VPP 调度充电'],
  ['dischargeCommand', '强制放电', '以指定功率放电，供给负载或向电网输出', '遵循 percentage 设定', 'VPP 调度放电']
];

// 八、频率限制说明（完整版）
const rateLimitSheet = [
  ['接口路径', '接口功能', '限流窗口', '限流模式', '说明', '超限返回'],
  ['/oauth2/getDeviceInfo', '查询设备信息', '60s', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 60 秒最多 1 次请求', 'code: 105\nmessage: "Endpoint rate limited for clientId=client***, retry after Xms"'],
  ['/oauth2/getDeviceData', '查询设备数据', '10s', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 10 秒最多 1 次请求', '同上'],
  ['/oauth2/getDeviceOperationMode', '查询设备运行模式', '60s', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 60 秒最多 1 次请求', '同上'],
  ['/oauth2/getDeviceEnergyData', '查询历史统计数据（按日/月）', '60s（建议）', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 60 秒最多 1 次请求\n历史查询较重，建议与 getDeviceInfo 限制一致', '同上'],
  ['/oauth2/getDeviceDailyDetail', '查询设备单日明细采样序列', '60s（建议）', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 60 秒最多 1 次请求\n历史查询较重，建议与 getDeviceInfo 限制一致', '同上'],
  ['/oauth2/deviceDispatch', '设备调度下发', '5s', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 5 秒最多 1 次请求（12 RPM）', '同上'],
  ['/oauth2/readDeviceDispatch', '读取调度参数', '5s', 'CLIENT_AND_DEVICE', '每个 client 对每个设备 5 秒最多 1 次请求（12 RPM）', '同上'],
  ['/oauth2/getDeviceList', '获取可授权设备列表', '60s', 'CLIENT_ONLY', '每个 client 60 秒最多 1 次请求（不区分设备）', '同上'],
  ['/oauth2/getDeviceListAuthed', '获取已授权设备列表', '60s', 'CLIENT_ONLY', '每个 client 60 秒最多 1 次请求（不区分设备）', '同上']
];

// 八-B、限流模式说明
const rateLimitModeSheet = [
  ['限流模式', '含义', '计算方式', '适用场景'],
  ['CLIENT_ONLY', '按 clientId 限制', '同一 client 对该接口的调用频率共享配额，不区分设备', '设备列表类接口（getDeviceList, getDeviceListAuthed）'],
  ['CLIENT_AND_DEVICE', '按 clientId + deviceSn 限制', '同一 client 对同一设备独立计算频率限制', '设备级操作接口（查询、控制类）'],
  ['', '', '', ''],
  ['响应示例', '', '', ''],
  ['触发限流返回', 'code: 105', '', ''],
  ['', 'data: null', '', ''],
  ['', 'message: "Endpoint rate limited for clientId=client***, retry after 43217ms"', '', ''],
  ['', '', '', ''],
  ['说明', 'clientId 只展示前 6 位，其余用 *** 脱敏', '', ''],
  ['', 'retry after Xms 为距本次限流窗口结束的剩余毫秒数', '', '']
];

// 九、状态码枚举
const statusCodeSheet = [
  ['状态类型', '状态码/值', '含义', '说明'],
  ['设备运行状态 (status)', '0', '待机', ''],
  ['', '1', '自检', ''],
  ['', '3', '故障', ''],
  ['', '4', '升级', ''],
  ['', '5', '光伏在线 & 电池离线 & 并网', ''],
  ['', '6', '光伏离线（或在线） & 电池在线 & 并网', ''],
  ['', '7', '光伏在线 & 电池在线 & 离网', ''],
  ['', '8', '光伏离线 & 电池在线 & 离网', ''],
  ['', '9', '旁路模式', ''],
  ['电池总体状态 (batteryStatus)', '0', '电池待机', ''],
  ['', '1', '电池断开', ''],
  ['', '2', '电池充电', ''],
  ['', '3', '电池放电', ''],
  ['', '4', '故障', ''],
  ['', '5', '升级', ''],
  ['工作优先级 (priority)', '0', '负载优先', ''],
  ['', '1', '电池优先', ''],
  ['', '2', '电网优先', ''],
  ['API 响应码 (code)', '0', '操作成功', 'SUCCESSFUL_OPERATION'],
  ['', '2', 'Token 无效', 'TOKEN_IS_INVALID'],
  ['', '5', '设备离线', 'DEVICE_OFFLINE'],
  ['', '6', '参数设置失败', 'PARAMETER_SETTING_FAILED'],
  ['', '12', '设备 SN 无权限', 'DEVICE_SN_DOES_NOT_HAVE_PERMISSION'],
  ['', '15', '设备无响应', 'PARAMETER_SETTING_DEVICE_NOT_RESPONDING'],
  ['', '16', '参数设置响应超时', 'PARAMETER_SETTING_RESPONSE_TIMEOUT'],
  ['', '18', '读取设备参数失败', 'READ_DEVICE_PARAM_FAIL'],
  ['', '19', '设备 ID 已存在', 'DEVICE_ID_ALREADY_EXISTS'],
  ['', '103', '授权模式错误', 'WRONG_GRANT_TYPE'],
  ['', '105', '请求过于频繁', 'TOO_MANY_REQUEST']
];

// 十、API 概览
const overviewSheet = [
  ['接口分类', '接口数量', '主要功能', '关键特性'],
  ['认证授权类', '6个', 'OAuth2 认证、设备授权管理', '支持 authorization_code 和 client_credentials 两种模式'],
  ['设备信息查询类', '1个', '查询设备静态配置信息', '返回 29 个字段，包含设备、采集器、电池、电站信息；60秒/次/设备'],
  ['设备数据查询类', '4个', '实时数据、运行模式、历史统计、单日明细', 'getDeviceData: 39个主字段，10秒/次\ngetDeviceOperationMode: 5种运行模式，60秒/次\ngetDeviceEnergyData: 按日/月统计，60秒/次\ngetDeviceDailyDetail: 单日采样序列，60秒/次'],
  ['设备数据推送类', '1个', 'Webhook 主动推送', '推送结构与 getDeviceData 一致'],
  ['设备调度控制类', '2个', '下发控制指令、回读参数', '支持 7 种 setType，5秒/次/设备'],
  ['', '', '├─ 分时段充放电', '最多 16 个时段'],
  ['', '', '├─ 时长功率充放电', '4 种子指令类型'],
  ['', '', '├─ 防逆流控制', '支持逆流/顺流双向控制'],
  ['', '', '├─ VPP 控制开关', ''],
  ['', '', '├─ 有功功率降额', ''],
  ['', '', '├─ 有功功率百分比', ''],
  ['', '', '└─ 远程充放电功率', ''],
  ['', '', '', ''],
  ['总计', '14个接口', '', '覆盖认证、实时查询、历史查询、控制、推送全流程']
];

// 创建工作簿
const wb = XLSX.utils.book_new();

// 添加工作表
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewSheet), '0-API概览');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(authSheet), '1-认证授权');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deviceInfoSheet), '2-设备信息查询');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deviceDataSheet), '3-设备数据查询');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pushSheet), '4-设备数据推送');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dispatchSheet), '5-设备调度控制');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(setTypeSheet), '6-调度指令详细');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeSheet), '7-充放电指令类型');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rateLimitSheet), '8-频率限制');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rateLimitModeSheet), '8B-限流模式说明');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statusCodeSheet), '9-状态码枚举');

// 输出文件
const outputPath = `Growatt_OpenAPI_功能清单 20260911.xlsx`;
XLSX.writeFile(wb, outputPath);

console.log(`✅ Excel 文件已生成：${outputPath}`);
console.log(`📊 工作表总数：11个`);
console.log(`📝 包含完整的请求/返回参数、状态码枚举、频率限制、API概览`);
console.log(`🆕 新增 getDeviceOperationMode 接口`);
console.log(`📋 完整的 7 个接口频率限制配置`);
