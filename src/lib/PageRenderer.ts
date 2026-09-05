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

      const secNode = xmlObj.sec ?? xmlObj.section ?? xmlObj["hp:section"] ?? xmlObj["hs:sec"];
      if (!secNode) continue;

      // Extract page layout attributes if present
      const baseLayout = this.extractPageLayout(secNode, renderedPages.length + 1);
      const usableHeightPt = Math.max(200, baseLayout.heightPt - baseLayout.marginTopPt - baseLayout.marginBottomPt);

      // Extract and paginate content into discrete pages
      const pageHtmlChunks = this.paginateSectionContent(
        secNode,
        usableHeightPt,
        files,
        characterProperties,
        fontFaces
      );

      for (let pIdx = 0; pIdx < pageHtmlChunks.length; pIdx++) {
        const pageNum = renderedPages.length + 1;
        const layout: PageLayoutInfo = {
          ...baseLayout,
          pageNumber: pageNum,
        };

        renderedPages.push({
          pageIndex: renderedPages.length,
          layout,
          html: pageHtmlChunks[pIdx] || "<p class=\"jhwpx-para\">&nbsp;</p>",
        });
      }
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
    const pagePr = secNode?.secPr?.pagePr ?? secNode?.pagePr ?? secNode?.["hp:secPr"]?.["hp:pagePr"] ?? secNode?.["hp:pagePr"];
    if (pagePr) {
      const w = pagePr["@width"] ?? pagePr["@w"] ?? pagePr["@hp:width"];
      const h = pagePr["@height"] ?? pagePr["@h"] ?? pagePr["@hp:height"];
      if (w) defaultLayout.widthPt = Number(w) / 100;
      if (h) defaultLayout.heightPt = Number(h) / 100;

      const margin = pagePr.margin ?? pagePr["hp:margin"];
      if (margin) {
        const top = margin["@top"] ?? margin["@hp:top"];
        const right = margin["@right"] ?? margin["@hp:right"];
        const bottom = margin["@bottom"] ?? margin["@hp:bottom"];
        const left = margin["@left"] ?? margin["@hp:left"];

        if (top) defaultLayout.marginTopPt = Number(top) / 100;
        if (right) defaultLayout.marginRightPt = Number(right) / 100;
        if (bottom) defaultLayout.marginBottomPt = Number(bottom) / 100;
        if (left) defaultLayout.marginLeftPt = Number(left) / 100;
      }
    }

    return defaultLayout;
  }

  /**
   * Paginate section paragraphs and tables across multiple pages based on page budget and explicit page breaks.
   */
  private paginateSectionContent(
    secNode: any,
    usableHeightPt: number,
    files: Record<string, Uint8Array>,
    charProps: Map<string, any>,
    fontFaces: Map<string, any>
  ): string[] {
    const pages: string[][] = [[]];
    let currentHeight = 0;

    const ps = secNode.p ?? secNode["hp:p"];
    if (ps) {
      const paras = Array.isArray(ps) ? ps : [ps];
      for (const p of paras) {
        const pb = p["@pageBreak"] ?? p["@hp:pageBreak"];
        const isExplicitBreak = pb === "1" || pb === 1;

        // Render paragraph HTML
        const pInner = this.renderParagraph(p, files, charProps, fontFaces);
        const alignStyle = this.getAlignStyle(p);
        const lineSpacingStyle = this.getLineSpacingStyle(p);
        const marginStyle = this.getMarginStyle(p);
        const styleAttr = `style="${alignStyle};${lineSpacingStyle};${marginStyle}"`;
        const paraHtml = `<p class="jhwpx-para" ${styleAttr}>${pInner}</p>`;

        // Collect tables embedded in paragraph
        const tables = this.collectTables(p);
        const tableHtmls = tables.map(tbl => this.renderTable(tbl, files, charProps, fontFaces));

        // Estimate item height in points
        const textLen = this.getParagraphTextLength(p);
        const lines = Math.max(1, Math.ceil(textLen / 50));
        let itemHeight = lines * 18 + 4; // ~18pt per line + margin

        for (const tbl of tables) {
          const trs = tbl.tr ?? tbl["hp:tr"];
          const rowCount = trs ? (Array.isArray(trs) ? trs.length : 1) : 1;
          itemHeight += rowCount * 26 + 10;
        }

        // Check if item fits in current page or requires a page break
        if ((isExplicitBreak || (currentHeight + itemHeight > usableHeightPt)) && currentHeight > 0) {
          pages.push([]);
          currentHeight = itemHeight;
        } else {
          currentHeight += itemHeight;
        }

        const curPage = pages[pages.length - 1];
        curPage.push(paraHtml);
        for (const tblHtml of tableHtmls) {
          curPage.push(tblHtml);
        }
      }
    }

    // Direct section tables (if any)
    const tbls = secNode.tbl ?? secNode["hp:tbl"];
    if (tbls) {
      const tables = Array.isArray(tbls) ? tbls : [tbls];
      for (const tbl of tables) {
        const tblHtml = this.renderTable(tbl, files, charProps, fontFaces);
        const trs = tbl.tr ?? tbl["hp:tr"];
        const rowCount = trs ? (Array.isArray(trs) ? trs.length : 1) : 1;
        const tblHeight = rowCount * 26 + 10;

        if (currentHeight + tblHeight > usableHeightPt && currentHeight > 0) {
          pages.push([]);
          currentHeight = tblHeight;
        } else {
          currentHeight += tblHeight;
        }
        pages[pages.length - 1].push(tblHtml);
      }
    }

    if (pages.length === 0 || (pages.length === 1 && pages[0].length === 0)) {
      return ["<p class=\"jhwpx-para\">&nbsp;</p>"];
    }

    return pages.map(pagePieces => pagePieces.join(""));
  }

  private getParagraphTextLength(p: any): number {
    const runs = p.run ?? p["hp:run"];
    if (!runs) return 0;
    const runArr = Array.isArray(runs) ? runs : [runs];
    let len = 0;
    for (const r of runArr) {
      const t = r.t ?? r["hp:t"];
      if (typeof t === "string") len += t.length;
      else if (typeof t === "number" || typeof t === "boolean") len += String(t).length;
      else if (typeof t?.["#text"] === "string") len += t["#text"].length;
    }
    return len;
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
        const imgInfo = this.resolveImage(files, pic);
        if (imgInfo) {
          const b64 = this.toBase64(imgInfo.bytes);
          textHtml += `<img src="data:${imgInfo.mime};base64,${b64}" class="jhwpx-image" alt="Image"/>`;
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

  private resolveImage(
    files: Record<string, Uint8Array>,
    pic: any
  ): { bytes: Uint8Array; mime: string } | null {
    const href = pic["@href"] ?? pic["@hp:href"];
    const img = pic.img ?? pic["hc:img"];
    const binRef = img?.["@binaryItemIDRef"] ?? img?.["@hc:binaryItemIDRef"] ?? href;

    const candidates = [
      href,
      binRef,
      binRef ? `BinData/${binRef}` : null,
      href ? `BinData/${href}` : null,
    ].filter(Boolean) as string[];

    for (const c of candidates) {
      if (files[c]) {
        return {
          bytes: files[c],
          mime: this.detectImageMime(files[c], c),
        };
      }
    }

    // Fuzzy matching against BinData files (ignoring extension or case differences)
    const baseName = String(binRef || href).replace(/^BinData\//i, "").toLowerCase();
    for (const k of Object.keys(files)) {
      if (k.toLowerCase().startsWith("bindata/")) {
        const fileBase = k.replace(/^BinData\//i, "").toLowerCase();
        if (fileBase === baseName || fileBase.startsWith(baseName + ".")) {
          return {
            bytes: files[k],
            mime: this.detectImageMime(files[k], k),
          };
        }
      }
    }

    return null;
  }

  private detectImageMime(bytes: Uint8Array, path: string): string {
    // Magic bytes detection
    if (bytes.length >= 4) {
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
      }
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return "image/png";
      }
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return "image/gif";
      }
      if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return "image/bmp";
      }
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return "image/webp";
      }
    }

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "bmp") return "image/bmp";
    if (ext === "webp") return "image/webp";

    return "image/png";
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
