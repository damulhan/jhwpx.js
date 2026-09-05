import { XMLParser } from "fast-xml-parser";
import type { PageLayoutInfo } from "./types";

export interface RenderedSection {
  pageIndex: number;
  layout: PageLayoutInfo;
  html: string;
}

export class PageRenderer {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      textNodeName: "#text",
      trimValues: false,
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
    });
  }

  /**
   * Parse XML string into object
   */
  public parseXml<T = any>(xml: string): T | null {
    try {
      return this.parser.parse(xml) as T;
    } catch {
      return null;
    }
  }

  /**
   * Extract sections with page layout and HTML content
   */
  public async renderPagesFromZip(
    files: Record<string, Uint8Array>,
    characterProperties: Map<string, any>,
    fontFaces: Map<string, any>
  ): Promise<RenderedSection[]> {
    // 1. Identify section files
    const sectionNames = Object.keys(files)
      .filter((p) => /^contents\/section\d+\.xml$/i.test(p))
      .sort((a, b) => {
        const na = Number(a.match(/section(\d+)\.xml/i)?.[1] ?? 0);
        const nb = Number(b.match(/section(\d+)\.xml/i)?.[1] ?? 0);
        return na - nb;
      });

    if (sectionNames.length === 0) {
      // Fallback
      return [];
    }

    const renderedPages: RenderedSection[] = [];
    const textDecoder = new TextDecoder("utf-8");

    for (let i = 0; i < sectionNames.length; i++) {
      const secPath = sectionNames[i];
      const rawBytes = files[secPath];
      if (!rawBytes) continue;
      const xmlStr = textDecoder.decode(rawBytes);
      const xmlObj = this.parseXml(xmlStr);
      if (!xmlObj) continue;

      const secNode = xmlObj.sec ?? xmlObj.section ?? xmlObj["hp:section"];
      if (!secNode) continue;

      // Extract page layout attributes if present
      const layout = this.extractPageLayout(secNode, i + 1);

      // Render inner HTML for this section
      const html = this.renderSectionContent(secNode, files, characterProperties, fontFaces);

      renderedPages.push({
        pageIndex: i,
        layout,
        html,
      });
    }

    return renderedPages;
  }

  private extractPageLayout(secNode: any, pageNum: number): PageLayoutInfo {
    // Standard A4 default in pt: 595.28 x 841.89 pt (210mm x 297mm)
    const defaultLayout: PageLayoutInfo = {
      pageNumber: pageNum,
      widthPt: 595.3,
      heightPt: 841.9,
      marginTopPt: 56.7, // ~20mm
      marginRightPt: 56.7, // ~20mm
      marginBottomPt: 42.5, // ~15mm
      marginLeftPt: 56.7, // ~20mm
    };

    // Look for pagePr or secPr
    const pagePr = secNode?.secPr?.pagePr ?? secNode?.pagePr;
    if (pagePr) {
      const w = pagePr["@width"] ?? pagePr["@w"];
      const h = pagePr["@height"] ?? pagePr["@h"];
      if (w) defaultLayout.widthPt = Number(w) / 100;
      if (h) defaultLayout.heightPt = Number(h) / 100;

      const margin = pagePr.margin ?? pagePr["hp:margin"];
      if (margin) {
        if (margin["@top"]) defaultLayout.marginTopPt = Number(margin["@top"]) / 100;
        if (margin["@right"]) defaultLayout.marginRightPt = Number(margin["@right"]) / 100;
        if (margin["@bottom"]) defaultLayout.marginBottomPt = Number(margin["@bottom"]) / 100;
        if (margin["@left"]) defaultLayout.marginLeftPt = Number(margin["@left"]) / 100;
      }
    }

    return defaultLayout;
  }

  private renderSectionContent(
    secNode: any,
    files: Record<string, Uint8Array>,
    charProps: Map<string, any>,
    fontFaces: Map<string, any>
  ): string {
    const pieces: string[] = [];

    const ps = secNode.p ?? secNode["hp:p"];
    if (ps) {
      const paras = Array.isArray(ps) ? ps : [ps];
      for (const p of paras) {
        const pInner = this.renderParagraph(p, files, charProps, fontFaces);
        const alignStyle = this.getAlignStyle(p);
        const lineSpacingStyle = this.getLineSpacingStyle(p);
        const marginStyle = this.getMarginStyle(p);

        const styleAttr = `style="${alignStyle};${lineSpacingStyle};${marginStyle}"`;
        pieces.push(`<p class="jhwpx-para" ${styleAttr}>${pInner}</p>`);

        // Collect tables embedded in paragraph
        const tables = this.collectTables(p);
        for (const tbl of tables) {
          pieces.push(this.renderTable(tbl, files, charProps, fontFaces));
        }
      }
    }

    // Direct section tables
    const tbls = secNode.tbl ?? secNode["hp:tbl"];
    if (tbls) {
      const tables = Array.isArray(tbls) ? tbls : [tbls];
      for (const tbl of tables) {
        pieces.push(this.renderTable(tbl, files, charProps, fontFaces));
      }
    }

    return pieces.join("");
  }

  private renderParagraph(
    p: any,
    files: Record<string, Uint8Array>,
    charProps: Map<string, any>,
    fontFaces: Map<string, any>
  ): string {
    const runs = p.run ?? p["hp:run"];
    if (!runs) return "";
    const runArr = Array.isArray(runs) ? runs : [runs];
    let html = "";

    for (const run of runArr) {
      if (run.secPr || run.ctrl) continue;

      // Text
      const t = run.t ?? run["hp:t"];
      let text = "";
      if (typeof t === "string") text = t;
      else if (typeof t === "number" || typeof t === "boolean") text = String(t);
      else if (typeof t?.["#text"] === "string") text = t["#text"];

      let textHtml = this.escapeHtml(text);

      // Embedded Picture
      const pic = run.pic ?? run["hp:pic"] ?? run.picture;
      if (pic) {
        const href = pic["@href"];
        const img = pic.img ?? pic["hc:img"];
        const binRef = img?.["@binaryItemIDRef"] ?? href;
        if (binRef) {
          const binPath = String(binRef).startsWith("BinData/") ? String(binRef) : `BinData/${binRef}`;
          const raw = files[binPath];
          if (raw) {
            const ext = binPath.split(".").pop()?.toLowerCase() ?? "png";
            const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/gif";
            const b64 = this.toBase64(raw);
            textHtml += `<img src="data:${mime};base64,${b64}" class="jhwpx-image" alt="Image"/>`;
          }
        }
      }

      // Styles
      const charPrId = run["@charPrIDRef"];
      if (charPrId !== undefined && charProps.has(String(charPrId))) {
        const prop = charProps.get(String(charPrId));
        textHtml = this.applyCharStyles(textHtml, prop, fontFaces);
      }

      html += textHtml;
    }

    return html || "&nbsp;";
  }

  private applyCharStyles(text: string, prop: any, fontFaces: Map<string, any>): string {
    let result = text;
    const styles: string[] = [];

    if (prop.bold) styles.push("font-weight:700");
    if (prop.italic) styles.push("font-style:italic");
    if (prop.underline && prop.underline["@type"] !== "NONE") {
      styles.push("text-decoration:underline");
    }
    if (prop.textColor && prop.textColor !== "#000000") {
      styles.push(`color:${this.normalizeColor(prop.textColor)}`);
    }
    if (prop.shadeColor && prop.shadeColor !== "none" && prop.shadeColor !== "#FFFFFF") {
      styles.push(`background-color:${this.normalizeColor(prop.shadeColor)}`);
    }
    if (prop.height) {
      const pt = Math.round((Number(prop.height) / 100) * 10) / 10;
      styles.push(`font-size:${pt}pt`);
    }

    if (prop.fontRef) {
      const hangulFontId = prop.fontRef["@hangul"];
      if (hangulFontId !== undefined && fontFaces.has(String(hangulFontId))) {
        const font = fontFaces.get(String(hangulFontId));
        const fontName = font["@name"];
        if (fontName) {
          styles.push(`font-family:'${fontName}', 'Pretendard', 'Noto Sans KR', sans-serif`);
        }
      }
    }

    const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
    return `<span${styleAttr}>${result}</span>`;
  }

  private renderTable(
    tbl: any,
    files: Record<string, Uint8Array>,
    charProps: Map<string, any>,
    fontFaces: Map<string, any>
  ): string {
    const trs = tbl.tr ?? tbl["hp:tr"];
    const rows = trs ? (Array.isArray(trs) ? trs : [trs]) : [];
    const rowHtml: string[] = [];

    rows.forEach((tr: any, rIdx: number) => {
      const tcs = tr.tc ?? tr["hp:tc"];
      const cells = tcs ? (Array.isArray(tcs) ? tcs : [tcs]) : [];
      const cellHtml: string[] = [];

      for (const tc of cells) {
        const colSpan = tc["@colSpan"] ?? tc["@colspan"] ?? tc["@gridSpan"];
        const rowSpan = tc["@rowSpan"] ?? tc["@rowspan"];
        const align = this.getAlignStyle(tc);

        const attrs: string[] = [];
        if (colSpan && String(colSpan) !== "1") attrs.push(`colspan="${colSpan}"`);
        if (rowSpan && String(rowSpan) !== "1") attrs.push(`rowspan="${rowSpan}"`);
        if (align) attrs.push(`style="${align}"`);

        // Cell sublist paragraphs
        const sub = tc.subList ?? tc["hp:subList"] ?? tc;
        const ps = sub.p ?? sub["hp:p"];
        let inner = "";
        if (ps) {
          const paras = Array.isArray(ps) ? ps : [ps];
          inner = paras.map((p: any) => this.renderParagraph(p, files, charProps, fontFaces)).join("<br/>");
        } else {
          inner = "&nbsp;";
        }

        const tag = rIdx === 0 && tbl["@header"] ? "th" : "td";
        cellHtml.push(`<${tag} class="jhwpx-cell" ${attrs.join(" ")}>${inner}</${tag}>`);
      }

      rowHtml.push(`<tr>${cellHtml.join("")}</tr>`);
    });

    return `<table class="jhwpx-table"><tbody>${rowHtml.join("")}</tbody></table>`;
  }

  private collectTables(p: any): any[] {
    const out: any[] = [];
    const runs = p.run ?? p["hp:run"];
    if (!runs) return out;
    const runArr = Array.isArray(runs) ? runs : [runs];
    for (const run of runArr) {
      if (run.secPr || run.ctrl) continue;
      const tbl = run.tbl ?? run["hp:tbl"];
      if (tbl) {
        if (Array.isArray(tbl)) out.push(...tbl);
        else out.push(tbl);
      }
    }
    return out;
  }

  private getAlignStyle(node: any): string {
    const a = node["@align"] ?? node["@textAlign"] ?? node.paraPr?.["@align"] ?? node.cellPr?.["@align"];
    if (typeof a !== "string") return "text-align:left";
    const v = a.toLowerCase();
    if (v === "center" || v === "right" || v === "justify" || v === "left") {
      return `text-align:${v}`;
    }
    return "text-align:left";
  }

  private getLineSpacingStyle(_node?: any): string {
    return "line-height:1.6";
  }

  private getMarginStyle(_node?: any): string {
    return "margin:0 0 4px 0";
  }

  private normalizeColor(c: string): string {
    const s = String(c).trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.startsWith("#") ? s : `#${s}`;
    return s;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
