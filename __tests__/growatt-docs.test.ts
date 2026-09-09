jest.mock("@/lib/growatt-docs/markdown", () => {
  const actualLinkRewriter = jest.requireActual(
    "@/lib/growatt-docs/link-rewriter",
  ) as typeof import("@/lib/growatt-docs/link-rewriter");

  return {
    extractMarkdownTitle: (markdown: string, fallbackTitle: string) => {
      const headingMatch = markdown.match(/^#\s+(.+)$/m);
      return headingMatch ? headingMatch[1].trim() : fallbackTitle;
    },
    renderGrowattMarkdownToHtml: async (
      markdown: string,
      { slugByFileName }: { slugByFileName: Map<string, string> },
    ) => {
      const rewritten = actualLinkRewriter.rewriteGrowattMarkdownLinks(markdown, {
        slugByFileName,
      });
      return `<article>${rewritten}</article>`;
    },
    prepareGrowattMarkdown: (
      markdown: string,
      { slugByFileName }: { slugByFileName: Map<string, string> },
    ) => actualLinkRewriter.rewriteGrowattMarkdownLinks(markdown, { slugByFileName }),
  };
});

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
  GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG,
  GROWATT_APPENDIX_TERMINOLOGY_SLUG,
  GROWATT_CODES_SLUG,
  GROWATT_PROTOCOL_MAPPING_HREF,
  GROWATT_PROTOCOL_MAPPING_SLUG,
  GROWATT_QUICK_GUIDE_SLUG,
  GROWATT_RELEASE_NOTES_SLUG,
  GROWATT_SEMANTIC_MODEL_SLUG,
  getGrowattAppendixDOpenApiSupportScopePage,
  getGrowattAppendixTerminologyPage,
  getGrowattCodesPage,
  getGrowattDocBySlug,
  getGrowattDocMetas,
  getGrowattOverview,
  getGrowattQuickGuide,
  getGrowattReleaseNotesPage,
  getGrowattSemanticModelPage,
  getGrowattSpecialPages,
} from "@/lib/growatt-docs";

const EXPECTED_MERMAID_COUNTS_BY_SLUG = {
  "01_authentication": 2,
  "02_api_access_token": 1,
  "03_api_refresh": 2,
  "04_api_device_auth": 1,
  "05_api_device_dispatch": 1,
  "06_api_read_dispatch": 2,
  "07_api_device_info": 2,
  "08_api_device_data": 2,
  "09_api_device_push": 1,
  "10_global_params": 2,
  "11_api_troubleshooting": 0,
} as const;

const EXPECTED_RUNTIME_TELEMETRY_FIELDS = [
  "data.batPower",
  "data.batteryList[].chargePower",
  "data.batteryList[].dischargePower",
  "data.batteryList[].echargeToday",
  "data.batteryList[].echargeTotal",
  "data.batteryList[].edischargeToday",
  "data.batteryList[].edischargeTotal",
  "data.batteryList[].ibat",
  "data.batteryList[].index",
  "data.batteryList[].soc",
  "data.batteryList[].soh",
  "data.batteryList[].status",
  "data.batteryList[].vbat",
  "data.batteryStatus",
  "data.deviceSn",
  "data.epvTotal",
  "data.genPower",
  "data.etoGridToday",
  "data.etoGridTotal",
  "data.etoUserToday",
  "data.etoUserTotal",
  "data.fac",
  "data.faultCode",
  "data.faultSubCode",
  "data.meterPower",
  "data.pac",
  "data.payLoadPower",
  "data.pexPower",
  "data.ppv",
  "data.priority",
  "data.protectCode",
  "data.protectSubCode",
  "data.reactivePower",
  "data.smartLoadPower",
  "data.soc",
  "data.status",
  "data.utcTime",
  "data.vac1",
  "data.vac2",
  "data.vac3",
] as const;

const EXPECTED_ENDPOINT_TELEMETRY_FIELDS = [
  "data.backupPower",
  "data.epvToday",
  "data.maxChargePower",
  "data.maxDischargePower",
  ...EXPECTED_RUNTIME_TELEMETRY_FIELDS,
] as const;

const EXPECTED_SEMANTIC_APPENDIX_BLOCK_FIELDS = [
  "dataType",
  ...EXPECTED_RUNTIME_TELEMETRY_FIELDS
    .filter((field) => field !== "data.smartLoadPower")
    .map((field) => field.replace(/^data\./, "")),
].sort();

function countMermaidBlocks(markdown: string | null | undefined) {
  return markdown?.match(/```mermaid/g)?.length ?? 0;
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

function extractTelemetryPayload(markdown: string) {
  const jsonBlocks = [...markdown.matchAll(/```json\s*([\s\S]*?)```/g)];

  for (const match of jsonBlocks) {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
      return parsed as { data: Record<string, unknown>; dataType?: string };
    }
  }

  throw new Error("Unable to locate telemetry payload example.");
}

function collectRuntimeFieldPaths(
  value: Record<string, unknown>,
  prefix = "data",
): string[] {
  const paths: string[] = [];

  for (const [key, nested] of Object.entries(value)) {
    const path = `${prefix}.${key}`;

    if (Array.isArray(nested)) {
      if (nested.length > 0 && nested.every((entry) => entry && typeof entry === "object")) {
        const nestedKeys = new Set<string>();
        for (const entry of nested as Array<Record<string, unknown>>) {
          for (const nestedKey of Object.keys(entry)) {
            nestedKeys.add(nestedKey);
          }
        }

        for (const nestedKey of [...nestedKeys].sort()) {
          paths.push(`${path}[].${nestedKey}`);
        }
      }
      continue;
    }

    if (nested && typeof nested === "object") {
      paths.push(...collectRuntimeFieldPaths(nested as Record<string, unknown>, path));
      continue;
    }

    paths.push(path);
  }

  return uniqueSorted(paths);
}

function extractExampleTelemetryFieldPaths(
  markdown: string,
  { includeDataType = false }: { includeDataType?: boolean } = {},
) {
  const payload = extractTelemetryPayload(markdown);
  const fields = collectRuntimeFieldPaths(payload.data);

  if (includeDataType && typeof payload.dataType === "string") {
    fields.push("dataType");
  }

  return uniqueSorted(fields);
}

function extractTableTelemetryFieldPaths(markdown: string) {
  const fields = [...markdown.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)]
    .map((match) => match[1])
    .filter(
      (field) =>
        field === "dataType" ||
        (field.startsWith("data.") && field !== "data" && field !== "data.batteryList"),
    );

  return uniqueSorted(fields);
}

function extractAppendixBlockCatalogFields(markdown: string) {
  const match = markdown.match(/## 6\.4 Telemetry Block Catalog([\s\S]*?)\r?\n---\r?\n\r?\n# 7\./);
  if (!match) {
    throw new Error("Unable to locate telemetry block catalog section.");
  }

  return uniqueSorted(
    [...match[1].matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((tableMatch) => tableMatch[1]),
  );
}

describe("growatt docs source-of-truth loader", () => {
  it("discovers numbered OPENAPI docs and excludes README plus appendix-only docs from the doc list", async () => {
    const docs = await getGrowattDocMetas("en");
    const fileNames = docs.map((doc) => doc.fileName);

    expect(fileNames.length).toBeGreaterThan(0);
    expect(fileNames).not.toContain("README.md");
    expect(fileNames).not.toContain("12_ess_terminology.md");
    expect(fileNames).not.toContain("13_ess_semantic_model.md");
    expect(fileNames).not.toContain("14_appendix_d_openapi_support_scope.md");
    expect(fileNames[0]).toMatch(/^01_/);
  });

  it("loads and renders the README overview", async () => {
    const overview = await getGrowattOverview("en");

    expect(overview.title).toContain("Growatt");
    expect(overview.html).toContain("<article>");
    expect(overview.html).toContain("/growatt-openapi/02_api_access_token");
    expect(overview.html).toContain("/growatt-openapi/growatt-codes");
    expect(overview.html).toContain("/growatt-openapi/appendix-terminology");
    expect(overview.html).toContain("/growatt-openapi/semantic-model");
    expect(overview.html).toContain("/growatt-openapi/appendix-d-openapi-support-scope");
    expect(overview.displayMarkdown).toContain("/growatt-openapi/02_api_access_token");
    expect(overview.displayMarkdown).toContain("/growatt-openapi/growatt-codes");
    expect(overview.displayMarkdown).toContain("/growatt-openapi/appendix-terminology");
    expect(overview.displayMarkdown).toContain("/growatt-openapi/semantic-model");
    expect(overview.displayMarkdown).toContain("/growatt-openapi/appendix-d-openapi-support-scope");
    expect(overview.displayMarkdown).not.toContain("12_ess_terminology");
    expect(overview.displayMarkdown.indexOf("/growatt-openapi/growatt-codes")).toBeLessThan(
      overview.displayMarkdown.indexOf("/growatt-openapi/appendix-terminology"),
    );
    expect(overview.displayMarkdown.indexOf("/growatt-openapi/appendix-terminology")).toBeLessThan(
      overview.displayMarkdown.indexOf("/growatt-openapi/semantic-model"),
    );
    expect(overview.displayMarkdown.indexOf("/growatt-openapi/semantic-model")).toBeLessThan(
      overview.displayMarkdown.indexOf("/growatt-openapi/appendix-d-openapi-support-scope"),
    );
    expect(overview.markdown).not.toContain("Baseline source:");
    expect(overview.markdown).not.toContain("vendor baseline");
  });

  it("loads markdown by slug and rewrites internal markdown links", async () => {
    const docs = await getGrowattDocMetas("en");
    const firstDoc = docs[0];
    const page = await getGrowattDocBySlug(firstDoc.slug, "en");

    expect(page).not.toBeNull();
    expect(page?.fileName).toBe(firstDoc.fileName);
    expect(page?.html).toContain("<article>");
    expect(page?.html).toContain("/growatt-openapi/04_api_device_auth");
    expect(page?.displayMarkdown).toContain("/growatt-openapi/04_api_device_auth");
  });

  it("loads and renders the English quick guide from the Growatt API root", async () => {
    const quickGuide = await getGrowattQuickGuide("en");

    expect(quickGuide.slug).toBe(GROWATT_QUICK_GUIDE_SLUG);
    expect(quickGuide.fileName).toBe("Growatt Open API Professional Integration Guide.md");
    expect(quickGuide.title).toBe("Growatt Open API Professional Integration Guide");
    expect(quickGuide.html).toContain("<article>");
    expect(quickGuide.displayMarkdown).toContain("/growatt-openapi/appendix-terminology");
    expect(quickGuide.displayMarkdown).not.toContain("12_ess_terminology");
    expect(quickGuide.markdown).toContain("## 5 Reliability and Error Handling");
    expect(quickGuide.markdown).toContain("## 6 Integration Checklist");
    expect(quickGuide.markdown).not.toContain("test/");
    expect(quickGuide.markdown).not.toContain("/prod-api/");
    expect(quickGuide.markdown).not.toContain("Baseline source:");
    expect(quickGuide.markdown).not.toContain("vendor baseline");
  });

  it("loads and renders the English customer-facing release notes page", async () => {
    const releaseNotes = await getGrowattReleaseNotesPage("en");

    expect(releaseNotes.slug).toBe(GROWATT_RELEASE_NOTES_SLUG);
    expect(releaseNotes.fileName).toBe("customer-api-doc-change-note-2026-08-14.en.md");
    expect(releaseNotes.title).toBe("Growatt Open API Changelog");
    expect(releaseNotes.html).toContain("<article>");
    expect(releaseNotes.markdown).toContain("## 2026-08-14");
    expect(releaseNotes.markdown).toContain("### Device Information");
    expect(releaseNotes.markdown).toContain("`getDeviceInfo`");
  });

  it("loads localized Chinese overview and doc titles without mojibake", async () => {
    const [overview, docs] = await Promise.all([
      getGrowattOverview("zh-CN"),
      getGrowattDocMetas("zh-CN"),
    ]);

    expect(overview.title).toBe("Growatt Open API 文档");
    expect(docs[0]?.title).toContain("身份认证");
    expect(overview.markdown).not.toContain("基线来源：");
    expect(overview.markdown).not.toContain("厂商基线");
  });

  it("loads localized Chinese quick guide markdown", async () => {
    const quickGuide = await getGrowattQuickGuide("zh-CN");

    expect(quickGuide.fileName).toBe(
      "Growatt Open API Professional Integration Guide.zh-CN.md",
    );
    expect(quickGuide.title).toBe("Growatt Open API 专业集成指南");
    expect(quickGuide.displayMarkdown).toContain("/growatt-openapi/appendix-terminology");
    expect(quickGuide.displayMarkdown).not.toContain("12_ess_terminology");
    expect(quickGuide.markdown).toContain("## 5 稳定性与错误处理");
    expect(quickGuide.markdown).toContain("## 6 集成检查清单");
    expect(quickGuide.markdown).not.toContain("test/");
    expect(quickGuide.markdown).not.toContain("/prod-api/");
    expect(quickGuide.markdown).not.toContain("基线来源：");
    expect(quickGuide.markdown).not.toContain("厂商基线");
  });

  it("loads localized Chinese release notes markdown", async () => {
    const releaseNotes = await getGrowattReleaseNotesPage("zh-CN");

    expect(releaseNotes.slug).toBe(GROWATT_RELEASE_NOTES_SLUG);
    expect(releaseNotes.fileName).toBe("customer-api-doc-change-note-2026-08-14.md");
    expect(releaseNotes.title).toBe("Growatt Open API 更新日志");
    expect(releaseNotes.markdown).toContain("## 2026-08-14");
    expect(releaseNotes.markdown).toContain("### 设备信息");
  });

  it("publishes appendix A/B/C links in both overview locales and appendix D in the English overview", async () => {
    const [overviewEn, overviewZh] = await Promise.all([
      getGrowattOverview("en"),
      getGrowattOverview("zh-CN"),
    ]);

    for (const overview of [overviewEn, overviewZh]) {
      expect(overview.displayMarkdown).toContain("/growatt-openapi/release-notes");
      expect(overview.displayMarkdown).toContain("/growatt-openapi/growatt-codes");
      expect(overview.displayMarkdown).toContain("/growatt-openapi/appendix-terminology");
      expect(overview.displayMarkdown).toContain("/growatt-openapi/semantic-model");
      expect(overview.displayMarkdown.indexOf("/growatt-openapi/release-notes")).toBeLessThan(
        overview.displayMarkdown.indexOf("/growatt-openapi/growatt-codes"),
      );
      expect(overview.displayMarkdown.indexOf("/growatt-openapi/growatt-codes")).toBeLessThan(
        overview.displayMarkdown.indexOf("/growatt-openapi/appendix-terminology"),
      );
      expect(overview.displayMarkdown.indexOf("/growatt-openapi/appendix-terminology")).toBeLessThan(
        overview.displayMarkdown.indexOf("/growatt-openapi/semantic-model"),
      );
    }

    expect(overviewEn.displayMarkdown).toContain("/growatt-openapi/appendix-d-openapi-support-scope");
    expect(overviewEn.displayMarkdown.indexOf("/growatt-openapi/semantic-model")).toBeLessThan(
      overviewEn.displayMarkdown.indexOf("/growatt-openapi/appendix-d-openapi-support-scope"),
    );
  });

  it("loads locale-specific appendix terminology, semantic model, and appendix D pages", async () => {
    const [appendixTermEn, appendixTermZh, semanticEn, semanticZh, appendixDEn, appendixDZh] = await Promise.all([
      getGrowattAppendixTerminologyPage("en"),
      getGrowattAppendixTerminologyPage("zh-CN"),
      getGrowattSemanticModelPage("en"),
      getGrowattSemanticModelPage("zh-CN"),
      getGrowattAppendixDOpenApiSupportScopePage("en"),
      getGrowattAppendixDOpenApiSupportScopePage("zh-CN"),
    ]);

    expect(appendixTermEn.slug).toBe(GROWATT_APPENDIX_TERMINOLOGY_SLUG);
    expect(appendixTermZh.slug).toBe(GROWATT_APPENDIX_TERMINOLOGY_SLUG);
    expect(appendixTermEn.fileName).toBe("13_ess_terminology.md");
    expect(appendixTermZh.fileName).toBe("13_ess_terminology.md");
    expect(appendixTermEn.title).toBe("Appendix B Glossary");
    expect(appendixTermZh.title).toBe("附录 B 术语表");
    expect(appendixTermEn.markdown).toContain("state of charge (SOC)");
    expect(appendixTermZh.markdown).toContain("公开术语表");
    expect(appendixTermEn.displayMarkdown).not.toContain("13_ess_terminology");
    expect(appendixTermEn.displayMarkdown).toContain("/growatt-openapi/semantic-model");
    expect(appendixTermZh.displayMarkdown).toContain("/growatt-openapi/semantic-model");

    expect(semanticEn.slug).toBe(GROWATT_SEMANTIC_MODEL_SLUG);
    expect(semanticZh.slug).toBe(GROWATT_SEMANTIC_MODEL_SLUG);
    expect(semanticEn.fileName).toBe("14_ess_semantic_model.md");
    expect(semanticZh.fileName).toBe("14_ess_semantic_model.md");
    expect(semanticEn.title).toBe("Appendix C Semantic Model");
    expect(semanticZh.title).toBe("附录 C 语义模型");
    expect(semanticEn.markdown).not.toBe(semanticZh.markdown);
    expect(semanticEn.markdown).toContain("# Growatt ESS Semantic Model and Dispatch Specification");
    expect(semanticEn.markdown).not.toContain("## Chinese");
    expect(semanticZh.markdown).toContain("# Growatt ESS 语义模型与调度规范");
    expect(semanticZh.markdown).not.toContain("## English");
    expect(semanticEn.markdown).toContain("**Status**: Customer Integration Reference");
    expect(semanticZh.markdown).toContain("本附录帮助客户从以下层面理解与 VPP 相关的字段");
    expect(semanticEn.markdown).not.toContain("V001");
    expect(semanticZh.markdown).not.toContain("验收标准");
    expect(semanticEn.markdown).not.toContain("Amber / AGL / Origin / Evergen");
    expect(semanticEn.markdown).not.toContain("对外口径");
    expect(semanticZh.markdown).not.toContain("閺堫剝顫夐懠鍐ㄧ殺");
    expect(countMermaidBlocks(semanticEn.markdown)).toBeGreaterThanOrEqual(5);
    expect(appendixDEn.slug).toBe(GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG);
    expect(appendixDZh.slug).toBe(GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG);
    expect(appendixDEn.fileName).toBe("14_appendix_d_openapi_support_scope.md");
    expect(appendixDZh.fileName).toBe("14_appendix_d_openapi_support_scope.md");
    expect(appendixDEn.title).toBe("Appendix D Supported Inverter Models");
    expect(appendixDEn.markdown).toContain("**Status**: Customer Integration Reference");
    expect(appendixDEn.markdown).toContain("## 3. Supported Inverter / PCE Models");
    expect(appendixDEn.markdown).toContain("#### 3.1.1 Residential Hybrid Inverters");
    expect(appendixDEn.markdown).not.toContain("Residential Hybrid Storage Inverters");
    expect(appendixDEn.markdown).toContain("## 4. Customer Compatibility Check");
    expect(appendixDEn.markdown).not.toContain("TBD");
    expect(appendixDEn.markdown).not.toContain("Pending Confirmation");
    expect(appendixDEn.markdown).not.toContain("Controlled Review Draft");
    expect(appendixDEn.markdown.match(/^\| INV-\d{3} \|/gm)).toHaveLength(15);
    expect(appendixDEn.markdown.match(/^\| BAT-\d{3} \|/gm)).toBeNull();
    expect(appendixDEn.markdown).not.toContain("### 3.2 Batteries");
    expect(appendixDEn.markdown).toContain("| Reference ID | Series | Models | OpenAPI Support Status |");
    expect(appendixDEn.markdown).toContain(
      "| INV-001 | SPH/SPA TL | `SPH 3000-6000TL BL` `SPH 3000-6000 TL BL-UP`",
    );
    expect(appendixDEn.markdown).toContain(
      "| ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |",
    );
    expect(
      appendixDEn.markdown.match(/\| ✓ \| ✓ \| ! \| ✓ \| ✓ \| ✓ \|/g),
    ).toHaveLength(5);
    expect(appendixDEn.markdown).not.toContain("APX 30.0P-S2 AU");
    expect(appendixDEn.markdown).not.toContain("dischargeCutOffSOC");
    expect(appendixDEn.displayMarkdown).not.toContain("14_appendix_d_openapi_support_scope");
    expect(appendixDZh.title).toBe("附录 D 支持的逆变器型号");
    expect(appendixDZh.markdown).toContain("**状态**: 客户集成参考");
    expect(appendixDZh.markdown).toContain("## 3. 支持的逆变器 / PCE 型号");
    expect(appendixDZh.markdown).toContain("#### 3.1.1 户用混合逆变器");
    expect(appendixDZh.markdown).not.toContain("户用并离网储能一体机");
    expect(appendixDZh.markdown).toContain("## 4. 客户兼容性检查");
    expect(appendixDZh.markdown).not.toContain("TBD");
    expect(appendixDZh.markdown).not.toContain("Pending Confirmation");
    expect(appendixDZh.markdown).not.toContain("受控评审稿");
    expect(appendixDZh.markdown.match(/^\| INV-\d{3} \|/gm)).toHaveLength(15);
    expect(appendixDZh.markdown.match(/^\| BAT-\d{3} \|/gm)).toBeNull();
    expect(appendixDZh.markdown).not.toContain("### 3.2 电池");
    expect(appendixDZh.markdown).toContain("## 2. 图标说明");
    expect(appendixDZh.markdown).toContain(
      "| INV-001 | SPH/SPA TL | `SPH 3000-6000TL BL` `SPH 3000-6000 TL BL-UP`",
    );
    expect(
      appendixDZh.markdown.match(/\| ✓ \| ✓ \| ! \| ✓ \| ✓ \| ✓ \|/g),
    ).toHaveLength(5);
    expect(appendixDZh.markdown).not.toContain("APX 30.0P-S2 AU");
    expect(appendixDZh.markdown).not.toContain("dischargeCutOffSOC");
  });

  it("restores expected Mermaid diagrams across overview, endpoint docs, and quick guide", async () => {
    const locales = ["en", "zh-CN"] as const;

    for (const locale of locales) {
      const [overview, quickGuide] = await Promise.all([
        getGrowattOverview(locale),
        getGrowattQuickGuide(locale),
      ]);

      expect(countMermaidBlocks(overview.markdown)).toBe(2);
      expect(countMermaidBlocks(quickGuide.markdown)).toBe(1);

      for (const [slug, expectedCount] of Object.entries(EXPECTED_MERMAID_COUNTS_BY_SLUG)) {
        const page = await getGrowattDocBySlug(slug, locale);

        expect(page).not.toBeNull();
        expect(countMermaidBlocks(page?.markdown)).toBe(expectedCount);
      }
    }
  });

  it("keeps the bilingual ESS glossary available only through appendix B", async () => {
    const [docsEn, docsZh, glossaryEn, glossaryZh, appendixEn, appendixZh] = await Promise.all([
      getGrowattDocMetas("en"),
      getGrowattDocMetas("zh-CN"),
      getGrowattDocBySlug("12_ess_terminology", "en"),
      getGrowattDocBySlug("12_ess_terminology", "zh-CN"),
      getGrowattAppendixTerminologyPage("en"),
      getGrowattAppendixTerminologyPage("zh-CN"),
    ]);

    expect(docsEn.map((doc) => doc.fileName)).not.toContain("12_ess_terminology.md");
    expect(docsZh.map((doc) => doc.fileName)).not.toContain("12_ess_terminology.md");
    expect(docsEn.map((doc) => doc.fileName)).not.toContain("13_ess_semantic_model.md");
    expect(docsZh.map((doc) => doc.fileName)).not.toContain("13_ess_semantic_model.md");
    expect(docsEn.map((doc) => doc.fileName)).not.toContain("14_appendix_d_openapi_support_scope.md");
    expect(docsZh.map((doc) => doc.fileName)).not.toContain("14_appendix_d_openapi_support_scope.md");
    expect(glossaryEn).toBeNull();
    expect(glossaryZh).toBeNull();
    expect(appendixEn.title).toBe("Appendix B Glossary");
    expect(appendixZh.title).toBe("附录 B 术语表");
    expect(appendixEn.markdown).toContain("state of charge (SOC)");
    expect(appendixEn.markdown).toContain("Export Limit");
    expect(appendixEn.markdown).toContain("[ESS Semantic Model](./14_ess_semantic_model.md)");
    expect(appendixZh.markdown).toContain("state of charge (SOC)");
    expect(appendixZh.markdown).toContain("[ESS 语义模型](./14_ess_semantic_model.md)");
    expect(appendixZh.markdown).not.toContain("基线来源：");
  });

  it("registers quick guide, release notes, protocol mapping, and appendix A/B/C/D/E special pages in navigation order", () => {
    const specialPages = getGrowattSpecialPages();

    expect(specialPages.map((page) => page.slug)).toEqual([
      GROWATT_QUICK_GUIDE_SLUG,
      GROWATT_RELEASE_NOTES_SLUG,
      GROWATT_PROTOCOL_MAPPING_SLUG,
      GROWATT_CODES_SLUG,
      GROWATT_APPENDIX_TERMINOLOGY_SLUG,
      GROWATT_SEMANTIC_MODEL_SLUG,
      GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
      GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG,
    ]);
    expect(specialPages[0]).toEqual(
      expect.objectContaining({
        slug: GROWATT_QUICK_GUIDE_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Quick Guide",
          "zh-CN": "快速指南",
        }),
        placement: "beforeDocs",
      }),
    );
    expect(specialPages[1]).toEqual(
      expect.objectContaining({
        slug: GROWATT_RELEASE_NOTES_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Release Notes",
          "zh-CN": "版本说明",
        }),
        placement: "beforeDocs",
      }),
    );
    expect(specialPages[2]).toEqual(
      expect.objectContaining({
        slug: GROWATT_PROTOCOL_MAPPING_SLUG,
        href: GROWATT_PROTOCOL_MAPPING_HREF,
        labelByLocale: expect.objectContaining({
          en: "Protocol Mapping",
          "zh-CN": "协议映射",
        }),
        placement: "afterDocs",
      }),
    );
    expect(specialPages[3]).toEqual(
      expect.objectContaining({
        slug: GROWATT_CODES_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Appendix A Growatt Codes",
          "zh-CN": "附录 A Growatt Codes",
        }),
        placement: "afterDocs",
      }),
    );
    expect(specialPages[4]).toEqual(
      expect.objectContaining({
        slug: GROWATT_APPENDIX_TERMINOLOGY_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Appendix B Glossary",
          "zh-CN": "附录 B 术语表",
        }),
        placement: "afterDocs",
      }),
    );
    expect(specialPages[5]).toEqual(
      expect.objectContaining({
        slug: GROWATT_SEMANTIC_MODEL_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Appendix C Semantic Model",
          "zh-CN": "附录 C 语义模型",
        }),
        placement: "afterDocs",
      }),
    );
    expect(specialPages[6]).toEqual(
      expect.objectContaining({
        slug: GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
        labelByLocale: expect.objectContaining({
          en: "Appendix D Supported Inverter Models",
          "zh-CN": "附录 D 支持的逆变器型号",
        }),
        placement: "afterDocs",
      }),
    );
  });

  it("removes the legacy shared semantic-model loader path", async () => {
    const [loaderSource, semanticPageSource] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "lib", "growatt-docs", "index.ts"), "utf8"),
      fs.readFile(
        path.join(process.cwd(), "app", "growatt-openapi", "semantic-model", "page.tsx"),
        "utf8",
      ),
    ]);

    expect(loaderSource).toContain('const GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME = "14_ess_semantic_model.md";');
    expect(loaderSource).not.toContain("growatt-ess-semantic-model-preliminary-review.md");
    expect(loaderSource).toContain('const GROWATT_DOCS_ROOT_DIR = path.join(process.cwd(), "docs");');
    expect(loaderSource).toContain(
      'RELEASE_NOTES_FILE_PATTERN',
    );
    expect(loaderSource).toContain("buildReleaseNotesFileName");
    expect(semanticPageSource).toContain("面向客户的 ESS 遥测语义与调度解释参考。");
    expect(semanticPageSource).not.toContain("鍏紑");
  });

  it("loads fault-code appendix content from the enterprise SSOT", async () => {
    const codes = await getGrowattCodesPage("en");

    expect(codes.slug).toBe(GROWATT_CODES_SLUG);
    expect(codes.title).toBe("Growatt Codes");
    expect(codes.sourceFileName).toBe("growatt_fault_code_enterprise_ssot.yaml");
    expect(codes.summary.total_records).toBe(180);
    expect(codes.summary.by_severity.error).toBe(94);
    expect(codes.summary.by_severity.protect).toBe(85);
    expect(codes.summary.by_severity.warning).toBe(1);
    expect(codes.html).toContain("Customer reference");
    expect(codes.html).toContain('id="error"');
    expect(codes.html).toContain('id="error-pv-side"');
    expect(codes.html).toContain("DC arc fault has been detected");
    expect(codes.html).not.toContain("LCD Display");
    expect(codes.html).not.toContain("Source workbook");
    expect(codes.html).not.toContain("Default VPP Action");
  });

  it("groups fault codes by severity and preserves category/code ordering", async () => {
    const codes = await getGrowattCodesPage("en");

    expect(codes.severityGroups.map((group) => group.severity)).toEqual([
      "error",
      "protect",
      "warning",
    ]);
    expect(codes.severityGroups[0]?.categories[0]?.category).toBe("PV side");
    expect(codes.severityGroups[0]?.categories[0]?.records[0]?.code).toBe(200);
    expect(codes.severityGroups[2]?.categories[0]?.records[0]?.code).toBe(1000);
  });

  it("documents grant-specific token request and response shapes", async () => {
    const [tokenDocEn, tokenDocZh] = await Promise.all([
      getGrowattDocBySlug("02_api_access_token", "en"),
      getGrowattDocBySlug("02_api_access_token", "zh-CN"),
    ]);

    expect(tokenDocEn).not.toBeNull();
    expect(tokenDocZh).not.toBeNull();

    const tokenEn = tokenDocEn!.markdown;
    const tokenZh = tokenDocZh!.markdown;
    const authCodeResponseEn =
      tokenEn
        .split("## Authorization-Code Response Example")[1]
        ?.split("## Client-Credentials Response Example")[0] ?? "";
    const clientCredentialsResponseEn =
      tokenEn
        .split("## Client-Credentials Response Example")[1]
        ?.split("## Customer Implementation Guidance")[0] ?? "";

    expect(tokenEn).toContain(
      "| `redirect_uri` | Yes | Registered callback URL; it must match the client configuration |",
    );
    expect(tokenEn).toContain("### `client_credentials`");
    expect(tokenEn).toContain("## Response Parameters");
    expect(authCodeResponseEn).toContain('"refresh_token": "<masked_refresh_token>"');
    expect(authCodeResponseEn).toContain('"refresh_expires_in": 2592000');
    expect(clientCredentialsResponseEn).toContain('"access_token": "<masked_access_token>"');
    expect(clientCredentialsResponseEn).toContain('"expires_in": 7200');
    expect(clientCredentialsResponseEn).not.toContain("refresh_token");
    expect(clientCredentialsResponseEn).not.toContain("refresh_expires_in");

    expect(tokenZh).toContain("### `client_credentials`");
    expect(tokenZh).toContain("## 返回参数");
    expect(tokenZh).not.toContain("2026-04-23 AU");
  });

  it("marks readDeviceDispatch requestId as required in both locales", async () => {
    const [readDispatchEn, readDispatchZh] = await Promise.all([
      getGrowattDocBySlug("06_api_read_dispatch", "en"),
      getGrowattDocBySlug("06_api_read_dispatch", "zh-CN"),
    ]);

    expect(readDispatchEn).not.toBeNull();
    expect(readDispatchZh).not.toBeNull();
    expect(readDispatchEn?.markdown).toContain("| `requestId` | string | Yes |");
    expect(readDispatchZh?.markdown).toContain("| `requestId` | string | 是 |");
  });

  it("keeps global parameters and response codes aligned in the published docs", async () => {
    const [globalParamsEn, globalParamsZh] = await Promise.all([
      getGrowattDocBySlug("10_global_params", "en"),
      getGrowattDocBySlug("10_global_params", "zh-CN"),
    ]);

    expect(globalParamsEn).not.toBeNull();
    expect(globalParamsZh).not.toBeNull();
    expect(globalParamsEn?.markdown).toContain("## Response Envelope");
    expect(globalParamsEn?.markdown).toContain("| Scenario | `code` | `data` | `message` |");

    for (const page of [globalParamsEn, globalParamsZh]) {
      expect(page).not.toBeNull();
      expect(page?.markdown).not.toContain("opencloud-test");
      expect(page?.markdown).toContain("READ_DEVICE_PARAM_FAIL");
      expect(page?.markdown).toContain("time_slot_charge_discharge");
      expect(page?.markdown).toContain("duration_and_power_charge_discharge");
      expect(page?.markdown).toContain("export_limit");
      expect(page?.markdown).toContain("enable_control");
      expect(page?.markdown).toContain("active_power_derating_percentage");
      expect(page?.markdown).toContain("active_power_percentage");
      expect(page?.markdown).toContain("remote_charge_discharge_power");
      expect(page?.markdown).toContain("exportLimitEnabled");
      expect(page?.markdown).not.toContain("anti_backflow");
      expect(page?.markdown).not.toContain("antiBackflowEnabled");
      expect(page?.markdown).toContain('"message": "RESPONSE_MESSAGE"');
      expect(page?.markdown).toContain('"data": "<endpoint-dependent>"');
      expect(page?.markdown).toContain("`code` | `data` | `message`");
      expect(page?.markdown).toContain('| `18` | `null` | `"READ_DEVICE_PARAM_FAIL"` |');
      expect(page?.markdown).toContain('| `103` |');
      expect(page?.markdown).toContain("WRONG_GRANT_TYPE");
      expect(page?.markdown).toContain('| `105` | `null` | `"TOO_MANY_REQUEST"` |');
    }
  });

  it("publishes push payloads directly instead of reusing query-model wording", async () => {
    const [pushDocEn, pushDocZh] = await Promise.all([
      getGrowattDocBySlug("09_api_device_push", "en"),
      getGrowattDocBySlug("09_api_device_push", "zh-CN"),
    ]);

    for (const page of [pushDocEn, pushDocZh]) {
      expect(page).not.toBeNull();
      expect(page?.markdown).toContain('"dataType": "dfcData"');
      expect(page?.markdown).toContain('"deviceSn": "DEVICE_SN_1"');
      expect(page?.markdown).toContain("| `data.genPower` | double |");
      expect(page?.markdown).not.toContain("same as the query model");
      expect(page?.markdown).not.toContain("same model as query");
      expect(page?.markdown).not.toContain("与查询模型一致");
    }
  });

  it("adds example columns and concrete values to device-data query tables", async () => {
    const [queryDocEn, queryDocZh] = await Promise.all([
      getGrowattDocBySlug("08_api_device_data", "en"),
      getGrowattDocBySlug("08_api_device_data", "zh-CN"),
    ]);

    expect(queryDocEn).not.toBeNull();
    expect(queryDocZh).not.toBeNull();

    expect(queryDocEn?.markdown).toContain("| Parameter | Type | Description | Example |");
    expect(queryDocEn?.markdown).toContain('| `data.reactivePower` | double | Reactive power (positive: capacitive, negative: inductive) | `174.90` |');
    expect(queryDocEn?.markdown).toContain('| `data.pexPower` | double | External generation power in W for third-party meter / Solar Inverter sources. Treat as a non-negative external-generation magnitude, not a grid import/export sign field | `14.30` |');
    expect(queryDocEn?.markdown).toContain('| `data.genPower` | double | Generator power in W for off-grid runtime when a generator source is present. Treat as a non-negative generator magnitude, not an AC-couple external-generation boundary signal | `0.00` |');
    expect(queryDocEn?.markdown).toContain('| `data.vac1` | double | Line voltage 1 in V | `236.90` |');
    expect(queryDocEn?.markdown).toContain('| `message` | string | Response description | `"SUCCESSFUL_OPERATION"` |');
    expect(queryDocZh?.markdown).toContain("| `data.pexPower` | double |");
    expect(queryDocZh?.markdown).toContain("| `data.genPower` | double |");

    expect(queryDocZh?.markdown).toContain("| 参数名 | 类型 | 说明 | 示例 |");
    expect(queryDocZh?.markdown).toContain('| `data.reactivePower` | double | 无功功率（正值：容性，负值：感性） | `174.90` |');
    expect(queryDocZh?.markdown).toContain('| `data.pexPower` | double | 第三方电表 / Solar Inverter 的外部发电功率，单位 W；应按非负的外部发电量值解释，不表示并网取电/馈电方向 | `14.30` |');
    expect(queryDocZh?.markdown).toContain('| `data.genPower` | double | 离网模式下的发电机功率，单位 W；有发电机源时按非负功率量值解释，它不是 AC-Couple 外部发电边界信号 | `0.00` |');
    expect(queryDocZh?.markdown).toContain('| `data.vac1` | double | 线电压 1，单位 V | `236.90` |');
    expect(queryDocZh?.markdown).toContain('| `message` | string | 返回说明 | `"SUCCESSFUL_OPERATION"` |');
  });

  it("keeps telemetry field tables aligned with the published query and push examples in both locales", async () => {
    const [queryEn, queryZh, pushEn, pushZh] = await Promise.all([
      getGrowattDocBySlug("08_api_device_data", "en"),
      getGrowattDocBySlug("08_api_device_data", "zh-CN"),
      getGrowattDocBySlug("09_api_device_push", "en"),
      getGrowattDocBySlug("09_api_device_push", "zh-CN"),
    ]);

    for (const page of [queryEn, queryZh]) {
      expect(page).not.toBeNull();
      expect(extractExampleTelemetryFieldPaths(page!.markdown)).toEqual(
        uniqueSorted(EXPECTED_ENDPOINT_TELEMETRY_FIELDS),
      );
      expect(extractTableTelemetryFieldPaths(page!.markdown)).toEqual(
        uniqueSorted(EXPECTED_ENDPOINT_TELEMETRY_FIELDS),
      );
    }

    for (const page of [pushEn, pushZh]) {
      expect(page).not.toBeNull();
      expect(extractExampleTelemetryFieldPaths(page!.markdown, { includeDataType: true })).toEqual(
        uniqueSorted(["dataType", ...EXPECTED_ENDPOINT_TELEMETRY_FIELDS]),
      );
      expect(extractTableTelemetryFieldPaths(page!.markdown)).toEqual(
        uniqueSorted(["dataType", ...EXPECTED_ENDPOINT_TELEMETRY_FIELDS]),
      );
    }

    expect(extractExampleTelemetryFieldPaths(queryEn!.markdown)).toEqual(
      extractExampleTelemetryFieldPaths(pushEn!.markdown),
    );
    expect(extractExampleTelemetryFieldPaths(queryZh!.markdown)).toEqual(
      extractExampleTelemetryFieldPaths(pushZh!.markdown),
    );
  });

  it("adds example columns and nested battery details to device-info tables", async () => {
    const [infoDocEn, infoDocZh] = await Promise.all([
      getGrowattDocBySlug("07_api_device_info", "en"),
      getGrowattDocBySlug("07_api_device_info", "zh-CN"),
    ]);

    expect(infoDocEn).not.toBeNull();
    expect(infoDocZh).not.toBeNull();

    expect(infoDocEn?.markdown).toContain("| Parameter | Type | Description | Example |");
    expect(infoDocEn?.markdown).toContain('| `deviceTypeName` | string | Device type name | `"min"` |');
    expect(infoDocEn?.markdown).toContain('| `existBattery` | boolean | Whether the device has a battery | `true` |');
    expect(infoDocEn?.markdown).toContain('| `batteryList[].batteryNominalPower` | int | Battery rated power in W | `2500` |');
    expect(infoDocEn?.markdown).toContain('| `dischargeCutOffSOC` | int | Battery discharge cut-off SOC in percent | `20` |');
    expect(infoDocEn?.markdown).not.toContain("grid-priority cut-off SOC");
    expect(infoDocEn?.markdown).toContain('| `unifiedAPIver` | string \\| null | Unified API version when reported; `null` when unavailable | `null` |');
    expect(infoDocEn?.markdown).toContain('| `deviceVersion` | string \\| null | Device firmware version when reported; `null` when unavailable | `null` |');
    expect(infoDocEn?.markdown).toContain('| `datalogVersion` | string \\| null | Datalogger firmware version when reported; `null` when unavailable | `"7.6.1.9"` |');
    expect(infoDocZh?.markdown).toContain("`unifiedAPIver`");
    expect(infoDocZh?.markdown).toContain("`deviceVersion`");
    expect(infoDocZh?.markdown).toContain("`datalogVersion`");

    expect(infoDocZh?.markdown).toContain("| 参数名 | 类型 | 说明 | 示例 |");
    expect(infoDocZh?.markdown).toContain('| `deviceTypeName` | string | 设备大类型名称 | `"min"` |');
    expect(infoDocZh?.markdown).toContain('| `existBattery` | boolean | 是否有电池 | `true` |');
    expect(infoDocZh?.markdown).toContain('| `batteryList[].batteryNominalPower` | int | 电池额定功率，单位 W | `2500` |');
    expect(infoDocZh?.markdown).toContain('| `dischargeCutOffSOC` | int | 电池放电截止 SOC（百分比） | `20` |');
    expect(infoDocZh?.markdown).not.toContain("电网优先放电截止 SOC");
  });

  it("standardizes ESS terminology in the reviewed English docs without renaming API keys", async () => {
    const [authDoc, infoDoc, dataDoc, pushDoc, globalDoc, faqDoc] = await Promise.all([
      getGrowattDocBySlug("04_api_device_auth", "en"),
      getGrowattDocBySlug("07_api_device_info", "en"),
      getGrowattDocBySlug("08_api_device_data", "en"),
      getGrowattDocBySlug("09_api_device_push", "en"),
      getGrowattDocBySlug("10_global_params", "en"),
      getGrowattDocBySlug("11_api_troubleshooting", "en"),
    ]);

    expect(authDoc).not.toBeNull();
    expect(infoDoc).not.toBeNull();
    expect(dataDoc).not.toBeNull();
    expect(pushDoc).not.toBeNull();
    expect(globalDoc).not.toBeNull();
    expect(faqDoc).not.toBeNull();

    expect(authDoc?.markdown).toContain("Rated inverter power in W");
    expect(authDoc?.markdown).toContain("Datalogger serial number");

    expect(infoDoc?.markdown).toContain("Rated inverter power in W");
    expect(infoDoc?.markdown).toContain("Battery rated capacity in Wh");
    expect(infoDoc?.markdown).toContain("Battery rated power in W");
    expect(infoDoc?.markdown).toContain("`batteryNominalPower`");

    expect(dataDoc?.markdown).toContain(
      "Grid meter power. Positive means grid import and negative means grid export, unit: W",
    );
    expect(pushDoc?.markdown).toContain(
      "Grid meter power. Positive means grid import and negative means grid export, unit: W",
    );
    expect(dataDoc?.markdown).toContain(
      "External generation power in W for third-party meter / Solar Inverter sources. Treat as a non-negative external-generation magnitude, not a grid import/export sign field",
    );
    expect(pushDoc?.markdown).toContain(
      "External generation power in W for third-party meter / Solar Inverter sources. Treat as a non-negative external-generation magnitude, not a grid import/export sign field",
    );
    expect(dataDoc?.markdown).toContain(
      "Generator power in W for off-grid runtime when a generator source is present. Treat as a non-negative generator magnitude, not an AC-couple external-generation boundary signal",
    );
    expect(pushDoc?.markdown).toContain(
      "Generator power in W for off-grid runtime when a generator source is present. Treat as a non-negative generator magnitude, not an AC-couple external-generation boundary signal",
    );
    expect(dataDoc?.markdown).toContain(
      "Device-local PV power in W. Core for Hybrid; auxiliary when reported alongside `pexPower` in AC-couple topologies",
    );
    expect(pushDoc?.markdown).toContain(
      "Device-local PV power in W. Core for Hybrid; auxiliary when reported alongside `pexPower` in AC-couple topologies",
    );
    expect(dataDoc?.markdown).toContain("Battery state of charge (SOC) in percent");
    expect(dataDoc?.markdown).toContain(
      "System-level battery state of charge (SOC) in percent",
    );
    expect(pushDoc?.markdown).toContain("Battery state of health (SOH) `[0,100]`");
    expect(dataDoc?.markdown).toContain("grid-connected");
    expect(pushDoc?.markdown).toContain("grid-connected");
    expect(dataDoc?.markdown).toContain("`data.payLoadPower`");
    expect(pushDoc?.markdown).toContain("`data.smartLoadPower`");
    expect(dataDoc?.markdown).toContain("`data.batteryList[].status`");
    expect(dataDoc?.markdown).toContain("`data.genPower`");
    expect(pushDoc?.markdown).toContain("`data.genPower`");
    expect(dataDoc?.markdown).toContain("`data.pexPower`");
    expect(pushDoc?.markdown).toContain("`data.pexPower`");
    expect(dataDoc?.markdown).toContain(
      "| `data.backupPower` | double | Backup output power in W when reported | `0.20` |",
    );
    expect(pushDoc?.markdown).toContain(
      "| `data.backupPower` | double | Backup output power in W when reported | `0.20` |",
    );

    expect(globalDoc?.markdown).toContain("Export Limit.");
    expect(globalDoc?.markdown).toContain("`export_limit`");

    expect(faqDoc?.displayMarkdown).toContain(
      "[ESS Terminology Glossary](/growatt-openapi/appendix-terminology)",
    );
  });

  it("renders device-dispatch response outcomes as tables", async () => {
    const [dispatchDocEn, dispatchDocZh] = await Promise.all([
      getGrowattDocBySlug("05_api_device_dispatch", "en"),
      getGrowattDocBySlug("05_api_device_dispatch", "zh-CN"),
    ]);

    expect(dispatchDocEn).not.toBeNull();
    expect(dispatchDocZh).not.toBeNull();

    expect(dispatchDocEn?.markdown).toContain("## Response Format Example");
    expect(dispatchDocEn?.markdown).toContain('"message": "RESPONSE_MESSAGE"');
    expect(dispatchDocEn?.markdown).toContain("| Scenario | `code` | `data` | `message` |");
    expect(dispatchDocEn?.markdown).toContain("| Response timeout | `16` | `null` | `PARAMETER_SETTING_RESPONSE_TIMEOUT` |");
    expect(dispatchDocEn?.markdown).toContain("| Too many requests | `105` | `null` | `TOO_MANY_REQUEST` |");
    expect(dispatchDocEn?.markdown).toContain("## Supported `setType` Values");
    expect(dispatchDocEn?.markdown).toContain("`export_limit`");
    expect(dispatchDocEn?.markdown).toContain("`remote_charge_discharge_power`");

    expect(dispatchDocZh?.markdown).toContain("## 返回格式示例");
    expect(dispatchDocZh?.markdown).toContain('"message": "RESPONSE_MESSAGE"');
    expect(dispatchDocZh?.markdown).toContain("| 场景 | `code` | `data` | `message` |");
    expect(dispatchDocZh?.markdown).toContain("| 参数设置响应超时 | `16` | `null` | `PARAMETER_SETTING_RESPONSE_TIMEOUT` |");
    expect(dispatchDocZh?.markdown).toContain("| 请求次数限制 | `105` | `null` | `TOO_MANY_REQUEST` |");
    expect(dispatchDocZh?.markdown).toContain("`export_limit`");
    expect(dispatchDocZh?.markdown).toContain("`remote_charge_discharge_power`");
  });

  it("documents readDeviceDispatch success payloads as array object and scalar shapes", async () => {
    const [readDispatchEn, readDispatchZh] = await Promise.all([
      getGrowattDocBySlug("06_api_read_dispatch", "en"),
      getGrowattDocBySlug("06_api_read_dispatch", "zh-CN"),
    ]);

    expect(readDispatchEn).not.toBeNull();
    expect(readDispatchZh).not.toBeNull();

    expect(readDispatchEn?.markdown).toContain("Parse data array / object / scalar");
    expect(readDispatchEn?.markdown).toContain("## Success Shapes by `setType`");
    expect(readDispatchEn?.markdown).toContain('"exportLimitEnabled": 1');
    expect(readDispatchEn?.markdown).toContain('"data": 1');
    expect(readDispatchEn?.markdown).toContain(
      "Scalar number: `enable_control`, `active_power_derating_percentage`, `active_power_percentage`, `remote_charge_discharge_power`",
    );

    expect(readDispatchZh?.markdown).toContain("解析 data 数组 / 对象 / 数值");
    expect(readDispatchZh?.markdown).toContain("## 各 `setType` 的成功返回结构");
    expect(readDispatchZh?.markdown).toContain('"exportLimitEnabled": 1');
    expect(readDispatchZh?.markdown).toContain('"data": 1');
    expect(readDispatchZh?.markdown).toContain(
      "数值：`enable_control`、`active_power_derating_percentage`、`active_power_percentage`、`remote_charge_discharge_power`",
    );
  });

  it("documents per-device telemetry and dispatch request pacing in both locales", async () => {
    const [
      dataDocEn,
      dataDocZh,
      dispatchDocEn,
      dispatchDocZh,
      readDispatchDocEn,
      readDispatchDocZh,
      faqDocEn,
      faqDocZh,
    ] = await Promise.all([
      getGrowattDocBySlug("08_api_device_data", "en"),
      getGrowattDocBySlug("08_api_device_data", "zh-CN"),
      getGrowattDocBySlug("05_api_device_dispatch", "en"),
      getGrowattDocBySlug("05_api_device_dispatch", "zh-CN"),
      getGrowattDocBySlug("06_api_read_dispatch", "en"),
      getGrowattDocBySlug("06_api_read_dispatch", "zh-CN"),
      getGrowattDocBySlug("11_api_troubleshooting", "en"),
      getGrowattDocBySlug("11_api_troubleshooting", "zh-CN"),
    ]);

    expect(dataDocEn?.markdown).toContain("`1 request / min / device`");
    expect(dataDocEn?.markdown).toContain("`TOO_MANY_REQUEST`");
    expect(dataDocZh?.markdown).toContain("`1 request / min / device`");
    expect(dataDocZh?.markdown).toContain("`TOO_MANY_REQUEST`");

    expect(dispatchDocEn?.markdown).toContain("`1 request / 5 sec / device` (`12 RPM`)");
    expect(dispatchDocZh?.markdown).toContain("`1 request / 5 sec / device`（`12 RPM`）");
    expect(readDispatchDocEn?.markdown).toContain("`1 request / 5 sec / device` (`12 RPM`)");
    expect(readDispatchDocZh?.markdown).toContain("`1 request / 5 sec / device`（`12 RPM`）");

    expect(faqDocEn?.markdown).toContain("`1 request / min / device`");
    expect(faqDocEn?.markdown).toContain("`1 request / 5 sec / device` (`12 RPM`)");
    expect(faqDocEn?.markdown).toContain("`code` `105`");
    expect(faqDocZh?.markdown).toContain("`1 request / min / device`");
    expect(faqDocZh?.markdown).toContain("`1 request / 5 sec / device`（`12 RPM`）");
    expect(faqDocZh?.markdown).toContain("`code` `105`");
  });

  it("documents formal 103 grant boundaries without exposing internal observations", async () => {
    const [guideEn, guideZh, faqEn, faqZh, authEn, authZh] = await Promise.all([
      getGrowattQuickGuide("en"),
      getGrowattQuickGuide("zh-CN"),
      getGrowattDocBySlug("11_api_troubleshooting", "en"),
      getGrowattDocBySlug("11_api_troubleshooting", "zh-CN"),
      getGrowattDocBySlug("04_api_device_auth", "en"),
      getGrowattDocBySlug("04_api_device_auth", "zh-CN"),
    ]);

    expect(guideEn.markdown).toContain("## 5 Reliability and Error Handling");
    expect(guideZh.markdown).toContain("## 5 稳定性与错误处理");
    expect(faqEn?.markdown).toContain("## 1. Can `client_credentials` call `getDeviceList`?");
    expect(faqZh?.markdown).toContain("## 1. `client_credentials` 能否调用 `getDeviceList`？");
    expect(guideEn.markdown).not.toContain("Integration Observations");
    expect(guideZh.markdown).not.toContain("联调观察");
    expect(faqEn?.markdown).not.toContain("test/");
    expect(faqZh?.markdown).not.toContain("test/");

    expect(guideEn.markdown).toContain("WRONG_GRANT_TYPE");
    expect(guideZh.markdown).toContain("WRONG_GRANT_TYPE");
    expect(faqEn?.markdown).toContain('`message="WRONG_GRANT_TYPE"`');
    expect(faqZh?.markdown).toContain('`message="WRONG_GRANT_TYPE"`');
    expect(authEn?.markdown).toContain('"code": 103');
    expect(authEn?.markdown).toContain('"message": "WRONG_GRANT_TYPE"');
    expect(authZh?.markdown).toContain('"code": 103');
    expect(authZh?.markdown).toContain('"message": "WRONG_GRANT_TYPE"');
  });

  it("publishes the AU full-report doc-fix change record", async () => {
    const changeRecord = await fs.readFile(
      path.join(process.cwd(), "docs", "oauth2-au-full-report-vs-docs-fix-2026-04-23.md"),
      "utf8",
    );

    expect(changeRecord).toContain(
      "test/oauth2-openApi-platform-au-full-test-report-2026-04-23.en.md",
    );
    expect(changeRecord).toContain("client_credentials");
    expect(changeRecord).toContain("WRONG_GRANT_TYPE");
    expect(changeRecord).toContain("data.soc");
    expect(changeRecord).toContain("backupPower");
    expect(changeRecord).toContain("not part of the Appendix C VPP core semantic model");
  });

  it("publishes a complete runtime telemetry block catalog in appendix C", async () => {
    const semantic = await getGrowattSemanticModelPage("en");
    const blockCatalogFields = extractAppendixBlockCatalogFields(semantic.markdown);

    expect(blockCatalogFields).toEqual(EXPECTED_SEMANTIC_APPENDIX_BLOCK_FIELDS);
    expect(semantic.markdown).toContain("GridMeter[Grid Meter]");
    expect(semantic.markdown).toContain("ExternalGeneration[External Generation]");
    expect(semantic.markdown).toContain(
      "| SP2 | Grid Meter Exchange Sign | `meterPower` | Grid Meter | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).toContain(
      "| SP4 | Load Power | `payLoadPower` | Load | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).toContain(
      "| SP7 | Export Limit Setting | `export_limit` (dispatch readback setting) | Grid Meter | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).toContain(
      "| SP8 | External Generation Power | `pexPower` | External Generation | AC Couple only |",
    );
    expect(semantic.markdown).toContain(
      "| SP9 | System SOC | `soc` | Battery Aggregate | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).toContain(
      "| System SOC | `soc` | Overall ESS battery system SOC | `%` | Query, Push | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).toContain(
      "| `soc` | Query, Push | System-level battery state of charge for the whole ESS battery system |",
    );
    expect(semantic.markdown).toContain(
      "`export_limit` is a dispatch setting value, not runtime telemetry.",
    );
    expect(semantic.markdown).toContain(
      "`export_limit` is intentionally excluded from this runtime telemetry mapping.",
    );
    expect(semantic.markdown).toContain(
      "Actual export direction and magnitude remain observed from `meterPower`",
    );
    expect(semantic.markdown).toContain(
      'Dispatch["Dispatch / Setting Readback<br/>deviceDispatch, read-dispatch, export_limit"]',
    );
    expect(semantic.markdown).toContain("| >0 | Grid import |");
    expect(semantic.markdown).toContain("| <0 | Grid export |");
    expect(semantic.markdown).toContain("| External Generation Boundary | N/A | Core |");
    expect(semantic.markdown).toContain("`batPower`");
    expect(semantic.markdown).toContain("`soc`");
    expect(semantic.markdown).toContain("`meterPower`");
    expect(semantic.markdown).toContain("`genPower`");
    expect(semantic.markdown).toContain("`pexPower`");
    expect(semantic.markdown).toContain("`export_limit`");
    expect(semantic.markdown).toContain("`remote_charge_discharge_power`");
    expect(semantic.markdown).toContain("`enable_control`");
    expect(semantic.markdown).toContain("`active_power_derating_percentage`");
    expect(semantic.markdown).toContain("`active_power_percentage`");
    expect(semantic.markdown).not.toContain("SP7(SP7: export_limit)");
    expect(semantic.markdown).not.toContain("`anti_backflow`");
    expect(semantic.markdown).not.toContain(
      "| Export Limit | `anti_backflow` | Control-only grid-meter export constraint | Control parameter | Dispatch | Hybrid, AC Couple |",
    );
    expect(semantic.markdown).not.toContain("smartLoadPower");
    expect(semantic.markdown).not.toContain("batteryPower");
    expect(semantic.markdown).not.toContain("gridPower");
    expect(semantic.markdown).not.toContain("pvPower");
    expect(semantic.markdown).not.toContain("loadPower");
    expect(semantic.markdown).not.toContain("backupPower");
  });

  it("adds the new runtime telemetry glossary terms in both locales", async () => {
    const [appendixEn, appendixZh] = await Promise.all([
      getGrowattAppendixTerminologyPage("en"),
      getGrowattAppendixTerminologyPage("zh-CN"),
    ]);

    expect(appendixEn.markdown).toContain("| Grid meter | 电网表 | grid meter | `meterPower`, `etoUserToday`, `etoUserTotal`, `etoGridToday`, `etoGridTotal` |");
    expect(appendixEn.markdown).toContain("| Grid meter power | 电网表功率 | grid meter power | `meterPower` |");
    expect(appendixEn.markdown).toContain("| External generation boundary | 外部发电边界 | external generation boundary | `pexPower` |");
    expect(appendixEn.markdown).toContain("| External generation power | 外部发电功率 | external generation power | `pexPower` |");
    expect(appendixEn.markdown).toContain("| Generator power | 发电机功率 | generator power | `genPower` |");
    expect(appendixEn.markdown).toContain("| Reactive power | 无功功率 | reactive power | `reactivePower` |");
    expect(appendixEn.markdown).toContain("| Grid frequency | 电网频率 | grid frequency | `fac` |");
    expect(appendixEn.markdown).toContain("| Line voltage | 线电压 | line voltage | `vac1`, `vac2`, `vac3` |");
    expect(appendixEn.markdown).toContain("| Battery pack status | 电池包状态 | battery pack status | `batteryList[].status` |");
    expect(appendixEn.markdown).toContain("| Load power | 负载功率 | load power | `payLoadPower`, `smartLoadPower` |");
    expect(appendixEn.markdown).toContain("| Smart-load power | Smart Load 负载功率 | smart-load power | `smartLoadPower` |");
    expect(appendixEn.markdown).not.toContain("`backupPower`");
    expect(appendixEn.markdown).toContain("external generation boundary");
    expect(appendixEn.markdown).toContain("external generation power");
    expect(appendixEn.markdown).toContain("generator power");
    expect(appendixEn.markdown).toContain("`pexPower`");
    expect(appendixEn.markdown).toContain("`genPower`");

    expect(appendixZh.markdown).toContain("| 电网表 | 电网表 | grid meter | `meterPower`, `etoUserToday`, `etoUserTotal`, `etoGridToday`, `etoGridTotal` |");
    expect(appendixZh.markdown).toContain("| 电网表功率 | 电网表功率 | grid meter power | `meterPower` |");
    expect(appendixZh.markdown).toContain("| 外部发电边界 | 外部发电边界 | external generation boundary | `pexPower` |");
    expect(appendixZh.markdown).toContain("| 外部发电功率 | 外部发电功率 | external generation power | `pexPower` |");
    expect(appendixZh.markdown).toContain("| 发电机功率 | 发电机功率 | generator power | `genPower` |");
    expect(appendixZh.markdown).toContain("| 无功功率 | 无功功率 | reactive power | `reactivePower` |");
    expect(appendixZh.markdown).toContain("| 电网频率 | 电网频率 | grid frequency | `fac` |");
    expect(appendixZh.markdown).toContain("| 线电压 | 线电压 | line voltage | `vac1`, `vac2`, `vac3` |");
    expect(appendixZh.markdown).toContain("| 电池包状态 | 电池包状态 | battery pack status | `batteryList[].status` |");
    expect(appendixZh.markdown).toContain("| 负载功率 | 负载功率 | load power | `payLoadPower`, `smartLoadPower` |");
    expect(appendixZh.markdown).toContain("| Smart Load 负载功率 | Smart Load 负载功率 | smart-load power | `smartLoadPower` |");
    expect(appendixZh.markdown).not.toContain("`backupPower`");
    expect(appendixZh.markdown).toContain("external generation boundary");
    expect(appendixZh.markdown).toContain("external generation power");
    expect(appendixZh.markdown).toContain("generator power");
    expect(appendixZh.markdown).toContain("`pexPower`");
    expect(appendixZh.markdown).toContain("genPower");
  });
});
