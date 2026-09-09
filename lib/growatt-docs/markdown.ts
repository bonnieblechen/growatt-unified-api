import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rewriteGrowattMarkdownLinks } from "./link-rewriter";

interface RenderMarkdownOptions {
  slugByFileName: Map<string, string>;
}

interface HastNode {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

const PRODUCT_REVIEW_CAPABILITY_HEADERS = new Set([
  "OAuth2 Access",
  "Device Info / Data",
  "Dispatch",
  "Readback Verification",
  "Data Push",
  "OAuth2 接入",
  "设备信息 / 数据",
  "下发调度",
  "回读校验",
  "数据推送",
]);

function getHastText(node: HastNode): string {
  if (node.type === "text") {
    return node.value ?? "";
  }

  return (node.children ?? []).map((child) => getHastText(child)).join("");
}

function addHastClass(node: HastNode, className: string): void {
  const currentClassName = node.properties?.className;
  const classNames = Array.isArray(currentClassName)
    ? currentClassName.filter((value): value is string => typeof value === "string")
    : typeof currentClassName === "string"
      ? currentClassName.split(/\s+/).filter(Boolean)
      : [];

  if (!classNames.includes(className)) {
    classNames.push(className);
  }

  node.properties = {
    ...node.properties,
    className: classNames,
  };
}

function getDescendantsByTagName(node: HastNode, tagName: string): HastNode[] {
  const matches: HastNode[] = [];

  const visit = (currentNode: HastNode): void => {
    if (currentNode.type === "element" && currentNode.tagName === tagName) {
      matches.push(currentNode);
    }

    currentNode.children?.forEach((child) => visit(child));
  };

  visit(node);
  return matches;
}

function rehypeMarkProductReviewTables() {
  return (tree: unknown) => {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") {
        return;
      }

      const hastNode = node as HastNode;

      if (hastNode.type === "element" && hastNode.tagName === "table") {
        const rows = getDescendantsByTagName(hastNode, "tr");
        const headerCells = (rows[0]?.children ?? []).filter(
          (child) => child.type === "element" && child.tagName === "th",
        );
        const headers = headerCells.map((cell) => getHastText(cell).trim());
        const isChinese = headers[0] === "清单编号";

        if (headers[0] === "Review ID" || headers[0] === "Reference ID" || isChinese) {
          addHastClass(hastNode, "growatt-product-review-table");

          const modelColumnIndex = headers.findIndex(
            (header) => header === "Models" || header === "Model" || header === "型号",
          );
          const statusColumnIndex = headers.findIndex(
            (header) =>
              header === "OpenAPI Support Status" || header === "OpenAPI 支持状态",
          );
          const capabilityColumnIndexes = new Set(
            headers.flatMap((header, index) =>
              PRODUCT_REVIEW_CAPABILITY_HEADERS.has(header) ? [index] : [],
            ),
          );

          rows.forEach((row) => {
            const cells = (row.children ?? []).filter(
              (child) =>
                child.type === "element" &&
                (child.tagName === "th" || child.tagName === "td"),
            );

            if (modelColumnIndex >= 0 && cells[modelColumnIndex]) {
              addHastClass(cells[modelColumnIndex], "growatt-product-model-cell");
            }

            if (statusColumnIndex >= 0 && cells[statusColumnIndex]) {
              const statusCell = cells[statusColumnIndex];
              addHastClass(statusCell, "growatt-product-status-cell");
              if (getHastText(statusCell).trim() === "✓") {
                addHastClass(statusCell, "growatt-product-status-confirmed");
                statusCell.properties = {
                  ...statusCell.properties,
                  ariaLabel: isChinese ? "已确认" : "Confirmed",
                  title: isChinese ? "已确认" : "Confirmed",
                };
              }
            }

            capabilityColumnIndexes.forEach((columnIndex) => {
              const cell = cells[columnIndex];
              if (!cell) {
                return;
              }

              addHastClass(cell, "growatt-product-capability-cell");
              const capability = getHastText(cell).trim();
              if (capability === "✓") {
                addHastClass(cell, "growatt-product-capability-supported");
                cell.properties = {
                  ...cell.properties,
                  ariaLabel: isChinese ? "支持" : "Supported",
                  title: isChinese ? "支持" : "Supported",
                };
              } else if (capability === "!") {
                addHastClass(cell, "growatt-product-capability-limited");
                cell.properties = {
                  ...cell.properties,
                  ariaLabel: isChinese
                    ? "支持，但存在字段限制；详情见备注"
                    : "Supported with field limitations; see notes",
                  title: isChinese
                    ? "支持，但存在字段限制；详情见备注"
                    : "Supported with field limitations; see notes",
                };
                cell.children = [
                  {
                    type: "element",
                    tagName: "span",
                    properties: {
                      className: ["growatt-product-capability-limited-icon"],
                      ariaHidden: "true",
                    },
                    children: [{ type: "text", value: "!" }],
                  },
                ];
              }
            });
          });
        }
      }

      hastNode.children?.forEach((child) => visit(child));
    };

    visit(tree);
  };
}

export function prepareGrowattMarkdown(
  markdown: string,
  options: RenderMarkdownOptions,
): string {
  return rewriteGrowattMarkdownLinks(markdown, {
    slugByFileName: options.slugByFileName,
  });
}

function rehypeExternalLinksTargetBlank() {
  return (tree: unknown) => {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") {
        return;
      }

      const hastNode = node as HastNode;

      if (hastNode.type === "element" && hastNode.tagName === "a") {
        const href = hastNode.properties?.href;
        if (typeof href === "string" && /^https?:\/\//i.test(href)) {
          hastNode.properties = {
            ...hastNode.properties,
            target: "_blank",
            rel: "noopener noreferrer",
          };
        }
      }

      if (Array.isArray(hastNode.children)) {
        hastNode.children.forEach((child) => visit(child));
      }
    };

    visit(tree);
  };
}

function rehypeMarkMermaidBlocks() {
  return (tree: unknown) => {
    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") {
        return;
      }

      const hastNode = node as HastNode;

      // Check for code blocks with language mermaid
      if (
        hastNode.type === "element" &&
        hastNode.tagName === "code"
      ) {
        const className = hastNode.properties?.className;
        if (Array.isArray(className) && className.includes("language-mermaid")) {
          // Add mermaid class for client-side detection
          hastNode.properties = {
            ...hastNode.properties,
            className: [...className, "mermaid"],
          };
        }
      }

      if (Array.isArray(hastNode.children)) {
        hastNode.children.forEach((child) => visit(child));
      }
    };

    visit(tree);
  };
}

export async function renderGrowattMarkdownToHtml(
  markdown: string,
  options: RenderMarkdownOptions,
): Promise<string> {
  const rewrittenMarkdown = prepareGrowattMarkdown(markdown, options);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeMarkProductReviewTables)
    .use(rehypeMarkMermaidBlocks)
    .use(rehypeExternalLinksTargetBlank)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(rewrittenMarkdown);

  return String(result);
}

export function extractMarkdownTitle(
  markdown: string,
  fallbackTitle: string,
): string {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (!headingMatch) {
    return fallbackTitle;
  }

  return headingMatch[1].replace(/`/g, "").trim();
}
