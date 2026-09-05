declare module "@ssabrojs/hwpxjs" {
  export class HwpxReader {
    loadFromArrayBuffer(buffer: ArrayBuffer): Promise<void>;
    getDocumentInfo(): Promise<any>;
    extractText(options?: any): Promise<string>;
    extractHtml(options?: any): Promise<string>;
    listImages(): Promise<string[]>;
  }
  export class HwpxWriter {
    createFromPlainText(text: string, options?: any): Promise<Uint8Array>;
  }
  export function detectFormat(data: Uint8Array): "hwp" | "hwpx" | "hwp3" | "unknown";
  export function hwpToHwpx(data: Uint8Array, options?: any): Promise<Uint8Array>;
  export function hwpToText(data: Uint8Array, options?: any): Promise<string>;
  export function htmlToHwpx(html: string, options?: any): Promise<Uint8Array>;
  export function markdownToHwpx(md: string, options?: any): Promise<Uint8Array>;
}
