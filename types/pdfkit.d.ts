// Minimal type declaration for pdfkit to satisfy the compiler
declare module "pdfkit" {
  export default class PDFDocument {
    constructor(options?: any);
    pipe(stream: any): void;
    fontSize(size: number): PDFDocument;
    text(text: string, options?: any): PDFDocument;
    moveDown(lines?: number): PDFDocument;
    end(): void;
  }
}
