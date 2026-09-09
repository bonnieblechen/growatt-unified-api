import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { buildGrowattSlugByFileName, toGrowattDocSlug } from "./link-rewriter";
import { GROWATT_CODES_SLUG } from "./growatt-codes";
import {
  extractMarkdownTitle,
  prepareGrowattMarkdown,
  renderGrowattMarkdownToHtml,
} from "./markdown";

export { GROWATT_CODES_SLUG, getGrowattCodesPage } from "./growatt-codes";

const GROWATT_API_ROOT_DIR = path.join(process.cwd(), "Growatt API");
const GROWATT_DOCS_ROOT_DIR = path.join(process.cwd(), "docs");
const EN_OPENAPI_ROOT_DIR = path.join(GROWATT_API_ROOT_DIR, "OPENAPI");
const ZH_OPENAPI_ROOT_DIR = path.join(GROWATT_API_ROOT_DIR, "OPENAPI.zh-CN");
const README_FILE_NAME = "README.md";
const EN_QUICK_GUIDE_FILE_NAME = "Growatt Open API Professional Integration Guide.md";
const ZH_QUICK_GUIDE_FILE_NAME = "Growatt Open API Professional Integration Guide.zh-CN.md";
const RELEASE_NOTES_FILE_PATTERN = /^customer-api-doc-change-note-(\d{4}-\d{2}-\d{2})(?:\.en)?\.md$/;

function buildReleaseNotesFileName(version: string, locale: GrowattDocLocale): string {
  if (locale === "en") {
    return `customer-api-doc-change-note-${version}.en.md`;
  }
  return `customer-api-doc-change-note-${version}.md`;
}
const GROWATT_TERMINOLOGY_DOC_FILE_NAME = "13_ess_terminology.md";
const GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME = "14_ess_semantic_model.md";
const GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_FILE_NAME =
  "15_appendix_d_openapi_support_scope.md";
const GROWATT_APPENDIX_E_API_RATE_LIMITING_FILE_NAME = "16_api_rate_limiting.md";
const NUMBERED_DOC_PATTERN = /^(\d+)_([a-z0-9_]+)\.md$/i;

export const GROWATT_QUICK_GUIDE_SLUG = "quick-guide";
export const GROWATT_RELEASE_NOTES_SLUG = "release-notes";
export const GROWATT_APPENDIX_TERMINOLOGY_SLUG = "appendix-terminology";
export const GROWATT_SEMANTIC_MODEL_SLUG = "semantic-model";
export const GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG =
  "appendix-d-openapi-support-scope";
export const GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG = "appendix-e-api-rate-limiting";
export const GROWATT_PROTOCOL_MAPPING_SLUG = "protocol-mapping";
export const GROWATT_PROTOCOL_MAPPING_HREF =
  "/growatt-openapi/protocol-mapping/index.html";

export type GrowattDocLocale = "en" | "zh-CN";

export interface GrowattSpecialPageNavMeta {
  slug: string;
  labelByLocale: Record<GrowattDocLocale, string>;
  href?: string;
  placement?: "beforeDocs" | "afterDocs";
  requiresDocumentNavigation?: boolean;
}

interface LocaleSourceConfig {
  openApiRootDir: string;
  quickGuideFileName: string;
  quickGuidePath: string;
  semanticModelFileName: string;
  overviewFallbackTitle: string;
  quickGuideFallbackTitle: string;
  releaseNotesFallbackTitle: string;
}

const GROWATT_DOC_SOURCE_CONFIG: Record<GrowattDocLocale, LocaleSourceConfig> = {
  en: {
    openApiRootDir: EN_OPENAPI_ROOT_DIR,
    quickGuideFileName: EN_QUICK_GUIDE_FILE_NAME,
    quickGuidePath: path.join(GROWATT_API_ROOT_DIR, EN_QUICK_GUIDE_FILE_NAME),
    semanticModelFileName: GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME,
    overviewFallbackTitle: "Growatt Open API Documentation",
    quickGuideFallbackTitle: "Quick Guide",
    releaseNotesFallbackTitle: "Release Notes",
  },
  "zh-CN": {
    openApiRootDir: ZH_OPENAPI_ROOT_DIR,
    quickGuideFileName: ZH_QUICK_GUIDE_FILE_NAME,
    quickGuidePath: path.join(GROWATT_API_ROOT_DIR, ZH_QUICK_GUIDE_FILE_NAME),
    semanticModelFileName: GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME,
    overviewFallbackTitle: "Growatt Open API 文档",
    quickGuideFallbackTitle: "快速指南",
    releaseNotesFallbackTitle: "版本说明",
  },
};

const RELEASE_NOTES_LABELS: Record<GrowattDocLocale, string> = {
  en: "Release Notes",
  "zh-CN": "版本说明",
};

const APPENDIX_A_LABELS: Record<GrowattDocLocale, string> = {
  en: "Appendix A Growatt Codes",
  "zh-CN": "附录 A Growatt Codes",
};

const PROTOCOL_MAPPING_LABELS: Record<GrowattDocLocale, string> = {
  en: "Protocol Mapping",
  "zh-CN": "协议映射",
};

const APPENDIX_B_LABELS: Record<GrowattDocLocale, string> = {
  en: "Appendix B Glossary",
  "zh-CN": "附录 B 术语表",
};

const APPENDIX_C_LABELS: Record<GrowattDocLocale, string> = {
  en: "Appendix C Semantic Model",
  "zh-CN": "附录 C 语义模型",
};

const APPENDIX_D_LABELS: Record<GrowattDocLocale, string> = {
  en: "Appendix D Supported Inverter Models",
  "zh-CN": "附录 D 支持的逆变器型号",
};

const APPENDIX_E_LABELS: Record<GrowattDocLocale, string> = {
  en: "Appendix E API Rate Limiting",
  "zh-CN": "附录 E 接口限流说明",
};

export interface GrowattDocMeta {
  fileName: string;
  slug: string;
  order: number;
  title: string;
}

export interface GrowattDocPage extends GrowattDocMeta {
  markdown: string;
  displayMarkdown: string;
  html: string;
}

export interface GrowattQuickGuidePage {
  slug: string;
  fileName: string;
  title: string;
  markdown: string;
  displayMarkdown: string;
  html: string;
}

export interface GrowattSpecialMarkdownPage {
  slug: string;
  fileName: string;
  title: string;
  markdown: string;
  displayMarkdown: string;
  html: string;
}

export function getGrowattSpecialPages(): GrowattSpecialPageNavMeta[] {
  return [
    {
      slug: GROWATT_QUICK_GUIDE_SLUG,
      labelByLocale: { en: "Quick Guide", "zh-CN": "快速指南" },
      placement: "beforeDocs",
    },
    {
      slug: GROWATT_RELEASE_NOTES_SLUG,
      labelByLocale: {
        en: RELEASE_NOTES_LABELS.en,
        "zh-CN": RELEASE_NOTES_LABELS["zh-CN"],
      },
      placement: "beforeDocs",
    },
    {
      slug: GROWATT_PROTOCOL_MAPPING_SLUG,
      href: GROWATT_PROTOCOL_MAPPING_HREF,
      labelByLocale: {
        en: PROTOCOL_MAPPING_LABELS.en,
        "zh-CN": PROTOCOL_MAPPING_LABELS["zh-CN"],
      },
      placement: "afterDocs",
      requiresDocumentNavigation: true,
    },
    {
      slug: GROWATT_CODES_SLUG,
      labelByLocale: {
        en: APPENDIX_A_LABELS.en,
        "zh-CN": APPENDIX_A_LABELS["zh-CN"],
      },
      placement: "afterDocs",
      requiresDocumentNavigation: true,
    },
    {
      slug: GROWATT_APPENDIX_TERMINOLOGY_SLUG,
      labelByLocale: {
        en: APPENDIX_B_LABELS.en,
        "zh-CN": APPENDIX_B_LABELS["zh-CN"],
      },
      placement: "afterDocs",
    },
    {
      slug: GROWATT_SEMANTIC_MODEL_SLUG,
      labelByLocale: {
        en: APPENDIX_C_LABELS.en,
        "zh-CN": APPENDIX_C_LABELS["zh-CN"],
      },
      placement: "afterDocs",
    },
    {
      slug: GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
      labelByLocale: {
        en: APPENDIX_D_LABELS.en,
        "zh-CN": APPENDIX_D_LABELS["zh-CN"],
      },
      placement: "afterDocs",
    },
    {
      slug: GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG,
      labelByLocale: {
        en: APPENDIX_E_LABELS.en,
        "zh-CN": APPENDIX_E_LABELS["zh-CN"],
      },
      placement: "afterDocs",
    },
  ];
}

function formatFallbackTitle(fileName: string): string {
  return fileName
    .replace(/\.md$/i, "")
    .replace(/^\d+_/, "")
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function extractOrder(fileName: string): number {
  const match = fileName.match(NUMBERED_DOC_PATTERN);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]);
}

function compareDocFiles(a: string, b: string): number {
  const orderDiff = extractOrder(a) - extractOrder(b);
  if (orderDiff !== 0) {
    return orderDiff;
  }

  return a.localeCompare(b);
}

function getLocaleSourceConfig(locale: GrowattDocLocale): LocaleSourceConfig {
  return GROWATT_DOC_SOURCE_CONFIG[locale];
}

function buildGrowattInternalSlugMap(
  fileNames: string[],
  opts?: { releaseNotesFileName?: string },
): Map<string, string> {
  const slugByFileName = buildGrowattSlugByFileName(fileNames);

  slugByFileName.set(EN_QUICK_GUIDE_FILE_NAME, GROWATT_QUICK_GUIDE_SLUG);
  slugByFileName.set(ZH_QUICK_GUIDE_FILE_NAME, GROWATT_QUICK_GUIDE_SLUG);

  if (opts?.releaseNotesFileName) {
    slugByFileName.set(opts.releaseNotesFileName, GROWATT_RELEASE_NOTES_SLUG);
  }

  // Keep appendix aliases stable even though these files are not part of the numbered doc nav.
  slugByFileName.set(GROWATT_TERMINOLOGY_DOC_FILE_NAME, GROWATT_APPENDIX_TERMINOLOGY_SLUG);
  slugByFileName.set(GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME, GROWATT_SEMANTIC_MODEL_SLUG);
  slugByFileName.set(
    GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_FILE_NAME,
    GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
  );
  slugByFileName.set(
    GROWATT_APPENDIX_E_API_RATE_LIMITING_FILE_NAME,
    GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG,
  );

  return slugByFileName;
}

async function readOpenApiMarkdownFiles(locale: GrowattDocLocale): Promise<string[]> {
  const entries = await fs.readdir(getLocaleSourceConfig(locale).openApiRootDir, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) =>
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md") &&
      !entry.name.startsWith("_")
    )
    .map((entry) => entry.name);
}

async function readOpenApiFile(fileName: string, locale: GrowattDocLocale): Promise<string> {
  const fullPath = path.join(getLocaleSourceConfig(locale).openApiRootDir, fileName);
  return fs.readFile(fullPath, "utf8");
}

export const getGrowattDocMetas = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattDocMeta[]> => {
    const markdownFileNames = await readOpenApiMarkdownFiles(locale);
    const docFileNames = markdownFileNames
      .filter(
        (fileName) =>
          fileName !== README_FILE_NAME &&
          fileName !== GROWATT_TERMINOLOGY_DOC_FILE_NAME &&
          fileName !== GROWATT_SEMANTIC_MODEL_DOC_FILE_NAME &&
          fileName !== GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_FILE_NAME &&
          fileName !== GROWATT_APPENDIX_E_API_RATE_LIMITING_FILE_NAME,
      )
      .sort(compareDocFiles);

    const docs = await Promise.all(
      docFileNames.map(async (fileName) => {
        const markdown = await readOpenApiFile(fileName, locale);

        return {
          fileName,
          slug: toGrowattDocSlug(fileName),
          order: extractOrder(fileName),
          title: extractMarkdownTitle(markdown, formatFallbackTitle(fileName)),
        };
      }),
    );

    return docs;
  },
);

export const getGrowattOverview = cache(async (locale: GrowattDocLocale = "en") => {
  const sourceConfig = getLocaleSourceConfig(locale);
  const markdown = await readOpenApiFile(README_FILE_NAME, locale);
  const docMetas = await getGrowattDocMetas(locale);
  const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));

  const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
  const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

  return {
    title: extractMarkdownTitle(markdown, sourceConfig.overviewFallbackTitle),
    markdown,
    displayMarkdown,
    html,
  };
});

export const getGrowattDocBySlug = cache(
  async (
    slug: string,
    locale: GrowattDocLocale = "en",
  ): Promise<GrowattDocPage | null> => {
    const docs = await getGrowattDocMetas(locale);
    const currentDoc = docs.find((doc) => doc.slug === slug);
    if (!currentDoc) {
      return null;
    }

    const markdown = await readOpenApiFile(currentDoc.fileName, locale);
    const slugByFileName = buildGrowattInternalSlugMap(docs.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      ...currentDoc,
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattQuickGuide = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattQuickGuidePage> => {
    const sourceConfig = getLocaleSourceConfig(locale);
    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      fs.readFile(sourceConfig.quickGuidePath, "utf8"),
    ]);

    const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_QUICK_GUIDE_SLUG,
      fileName: sourceConfig.quickGuideFileName,
      title: extractMarkdownTitle(markdown, sourceConfig.quickGuideFallbackTitle),
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattReleaseNoteVersions = cache(
  async (): Promise<string[]> => {
    const entries = await fs.readdir(GROWATT_DOCS_ROOT_DIR, { withFileTypes: true });
    const versions = new Set<string>();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(RELEASE_NOTES_FILE_PATTERN);
      if (match) {
        versions.add(match[1]);
      }
    }

    return Array.from(versions).sort((a, b) => b.localeCompare(a));
  },
);

export const getGrowattReleaseNotesPageByVersion = cache(
  async (
    version: string,
    locale: GrowattDocLocale = "en",
  ): Promise<GrowattSpecialMarkdownPage> => {
    const sourceConfig = getLocaleSourceConfig(locale);
    const fileName = buildReleaseNotesFileName(version, locale);
    const filePath = path.join(GROWATT_DOCS_ROOT_DIR, fileName);

    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      fs.readFile(filePath, "utf8"),
    ]);

    const slugByFileName = buildGrowattInternalSlugMap(
      docMetas.map((doc) => doc.fileName),
      { releaseNotesFileName: fileName },
    );
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_RELEASE_NOTES_SLUG,
      fileName,
      title: extractMarkdownTitle(markdown, sourceConfig.releaseNotesFallbackTitle),
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattReleaseNotesPage = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattSpecialMarkdownPage> => {
    const sourceConfig = getLocaleSourceConfig(locale);
    const fileName = locale === "en" ? "RELEASE_NOTES.en.md" : "RELEASE_NOTES.zh-CN.md";
    const filePath = path.join(GROWATT_DOCS_ROOT_DIR, fileName);

    try {
      const [docMetas, markdown] = await Promise.all([
        getGrowattDocMetas(locale),
        fs.readFile(filePath, "utf8"),
      ]);

      const slugByFileName = buildGrowattInternalSlugMap(
        docMetas.map((doc) => doc.fileName),
      );
      const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
      const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

      return {
        slug: GROWATT_RELEASE_NOTES_SLUG,
        fileName,
        title: extractMarkdownTitle(markdown, sourceConfig.releaseNotesFallbackTitle),
        markdown,
        displayMarkdown,
        html,
      };
    } catch (error) {
      return {
        slug: GROWATT_RELEASE_NOTES_SLUG,
        fileName: "",
        title: sourceConfig.releaseNotesFallbackTitle,
        markdown: "",
        displayMarkdown: "",
        html: "",
      };
    }
  },
);

export const getGrowattAppendixTerminologyPage = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattSpecialMarkdownPage> => {
    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      readOpenApiFile(GROWATT_TERMINOLOGY_DOC_FILE_NAME, locale),
    ]);
    const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_APPENDIX_TERMINOLOGY_SLUG,
      fileName: GROWATT_TERMINOLOGY_DOC_FILE_NAME,
      title: APPENDIX_B_LABELS[locale],
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattSemanticModelPage = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattSpecialMarkdownPage> => {
    const sourceConfig = getLocaleSourceConfig(locale);
    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      readOpenApiFile(sourceConfig.semanticModelFileName, locale),
    ]);

    const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_SEMANTIC_MODEL_SLUG,
      fileName: sourceConfig.semanticModelFileName,
      title: APPENDIX_C_LABELS[locale],
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattAppendixDOpenApiSupportScopePage = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattSpecialMarkdownPage> => {
    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      readOpenApiFile(GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_FILE_NAME, locale),
    ]);

    const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_SLUG,
      fileName: GROWATT_APPENDIX_D_OPENAPI_SUPPORT_SCOPE_FILE_NAME,
      title: APPENDIX_D_LABELS[locale],
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export const getGrowattAppendixEApiRateLimitingPage = cache(
  async (locale: GrowattDocLocale = "en"): Promise<GrowattSpecialMarkdownPage> => {
    const [docMetas, markdown] = await Promise.all([
      getGrowattDocMetas(locale),
      readOpenApiFile(GROWATT_APPENDIX_E_API_RATE_LIMITING_FILE_NAME, locale),
    ]);

    const slugByFileName = buildGrowattInternalSlugMap(docMetas.map((doc) => doc.fileName));
    const displayMarkdown = prepareGrowattMarkdown(markdown, { slugByFileName });
    const html = await renderGrowattMarkdownToHtml(displayMarkdown, { slugByFileName });

    return {
      slug: GROWATT_APPENDIX_E_API_RATE_LIMITING_SLUG,
      fileName: GROWATT_APPENDIX_E_API_RATE_LIMITING_FILE_NAME,
      title: APPENDIX_E_LABELS[locale],
      markdown,
      displayMarkdown,
      html,
    };
  },
);

export function getGrowattOpenApiRootDir(locale: GrowattDocLocale = "en"): string {
  return getLocaleSourceConfig(locale).openApiRootDir;
}
