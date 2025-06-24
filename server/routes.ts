import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPatientRecordSchema, insertConsentRecordSchema } from "@shared/schema";
import { registerWeb3Routes } from "./web3-routes";
import { registerSimplifiedPatientRoutes } from "./simplified-patient-routes";
import { z } from "zod";

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Simplified patient routes with Web3 backend, Web2 UX
  registerSimplifiedPatientRoutes(app);

  // Setup Web3 routes
  registerWeb3Routes(app);

  // Submit patient record (Hospital A)
  app.post("/api/submit_record", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "A") {
        return res.status(403).json({ message: "Only Hospital A can submit records" });
      }

      const validatedData = insertPatientRecordSchema.parse(req.body);
      
      const record = await storage.createPatientRecord({
        ...validatedData,
        submittedBy: user.id,
      });

      res.status(201).json({ 
        message: "Record submitted successfully", 
        recordId: record.id 
      });
    } catch (error) {
      next(error);
    }
  });

  // Get patient records (Hospital B)
  app.post("/api/get_records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      if (user.hospitalType !== "B") {
        return res.status(403).json({ message: "Only Hospital B can retrieve records" });
      }

      const { nationalId } = z.object({ nationalId: z.string() }).parse(req.body);
      
      const records = await storage.getPatientRecordsByNationalId(nationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Return patient info and record count for consent modal
      res.json({
        patientName: records[0].patientName,
        nationalId: records[0].nationalId,
        recordCount: records.length,
        records: records.map(record => ({
          id: record.id,
          visitDate: record.visitDate,
          visitType: record.visitType,
          diagnosis: record.diagnosis,
          prescription: record.prescription,
          physician: record.physician,
          department: record.department,
          submittedAt: record.submittedAt,
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Grant consent and access records
  app.post("/api/consent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = req.user!;
      const { nationalId, consentGrantedBy } = z.object({
        nationalId: z.string(),
        consentGrantedBy: z.string(),
      }).parse(req.body);

      const records = await storage.getPatientRecordsByNationalId(nationalId);
      
      if (records.length === 0) {
        return res.status(404).json({ message: "No records found for this patient" });
      }

      // Create consent records for each patient record
      for (const record of records) {
        await storage.createConsentRecord({
          patientId: nationalId,
          accessedBy: user.id,
          recordId: record.id,
          consentGrantedBy,
        });
      }

      res.json({ 
        message: "Consent granted successfully",
        records: records
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
