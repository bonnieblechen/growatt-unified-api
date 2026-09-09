import type { Metadata } from "next";
import "../docs.css";
import {
  getGrowattDocMetas,
  getGrowattReleaseNotesPage,
  getGrowattSpecialPages,
} from "@/lib/growatt-docs";
import { GrowattDocsShell } from "../docs-shell";

export const metadata: Metadata = {
  title: "Release Notes | Growatt Open API Docs",
  description: "Customer-facing release notes for Growatt Open API documentation updates.",
};

export const dynamic = "force-static";

export default async function GrowattOpenApiReleaseNotesPage() {
  const [docsEn, docsZh, enPage, zhPage] = await Promise.all([
    getGrowattDocMetas("en"),
    getGrowattDocMetas("zh-CN"),
    getGrowattReleaseNotesPage("en"),
    getGrowattReleaseNotesPage("zh-CN"),
  ]);

  return (
    <GrowattDocsShell
      docsByLocale={{ en: docsEn, "zh-CN": docsZh }}
      specialPages={getGrowattSpecialPages()}
      activeSlug={enPage?.slug ?? "release-notes"}
      headingByLocale={{
        en: enPage?.title ?? "Release Notes",
        "zh-CN": zhPage?.title ?? enPage?.title ?? "Release Notes",
      }}
      subheadingByLocale={{
        en: "Customer-facing version summary and website announcement entry.",
        "zh-CN": "面向客户的版本说明与官网公告入口。",
      }}
      contentMarkdownByLocale={{
        en: enPage?.displayMarkdown ?? "",
        "zh-CN": zhPage?.displayMarkdown ?? "",
      }}
      contentHtmlByLocale={{
        en: enPage?.html ?? "",
        "zh-CN": zhPage?.html ?? "",
      }}
    />
  );
}
