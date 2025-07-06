import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface StaffVCPdfData {
  staffId: string;
  name: string;
  role: string;
  department: string;
  licenseNumber: string;
  hospitalId: string;
  hospitalName: string;
  issueDate: string;
  vcJwt: string;
}

export async function generateStaffVCPdf(data: StaffVCPdfData): Promise<string> {
  const pdfDir = path.join(process.env.STAFF_VC_PDF_DIR || "./vc_pdfs");
  await fs.promises.mkdir(pdfDir, { recursive: true });
  const fileName = `StaffVC_${data.staffId}_${Date.now()}.pdf`;
  const filePath = path.join(pdfDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text("MediBridge Staff Employment Credential", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Name: ${data.name}`);
    doc.text(`Staff ID: ${data.staffId}`);
    doc.text(`Role: ${data.role}`);
    doc.text(`Department: ${data.department}`);
    doc.text(`License Number: ${data.licenseNumber}`);
    doc.text(`Hospital: ${data.hospitalName} (ID: ${data.hospitalId})`);
    doc.text(`Issued: ${data.issueDate}`);
    doc.moveDown();
    doc.fontSize(12).text("Verifiable Credential (JWT):", { underline: true });
    doc.fontSize(8).text(data.vcJwt, { width: 500 });
    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
} 