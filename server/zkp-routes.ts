import type { Express } from "express";
import { z } from "zod";
import { ZKPService } from "./zkp-service";
import { auditService } from "./audit-service";
import { requirePatientAuth } from "./patient-auth-middleware";

export function registerZKPRoutes(app: Express) {
  // Generate ZKP proof for medical condition
  app.post("/api/zkp/generate-condition-proof", requirePatientAuth, async (req, res) => {
    try {
      const { condition, publicStatement, expiresInDays } = z.object({
        condition: z.string().min(1, "Condition is required"),
        publicStatement: z.string().min(1, "Public statement is required"),
        expiresInDays: z.number().min(1).max(365).default(30)
      }).parse(req.body);

      const patientDID = (req.user as any).patientDID;
      const zkpService = await ZKPService.getInstance();
      
      const result = await zkpService.generateConditionProof(
        patientDID,
        condition,
        publicStatement,
        expiresInDays
      );

      res.json({
        success: true,
        proofId: result.proofId,
        message: "ZKP proof generated successfully",
        publicStatement,
        expiresInDays
      });

    } catch (error: any) {
      console.error("ZKP condition proof generation failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Generate ZKP proof for age verification
  app.post("/api/zkp/generate-age-proof", requirePatientAuth, async (req, res) => {
    try {
      const { birthDate, minAge, publicStatement, expiresInDays } = z.object({
        birthDate: z.string().datetime(),
        minAge: z.number().min(0).max(120),
        publicStatement: z.string().min(1, "Public statement is required"),
        expiresInDays: z.number().min(1).max(365).default(30)
      }).parse(req.body);

      const patientDID = (req.user as any).patientDID;
      const zkpService = await ZKPService.getInstance();
      
      const result = await zkpService.generateAgeProof(
        patientDID,
        new Date(birthDate),
        minAge,
        publicStatement,
        expiresInDays
      );

      res.json({
        success: true,
        proofId: result.proofId,
        message: "ZKP age proof generated successfully",
        publicStatement,
        expiresInDays
      });

    } catch (error: any) {
      console.error("ZKP age proof generation failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Generate ZKP proof for allergy verification
  app.post("/api/zkp/generate-allergy-proof", requirePatientAuth, async (req, res) => {
    try {
      const { allergy, publicStatement, expiresInDays } = z.object({
        allergy: z.string().min(1, "Allergy is required"),
        publicStatement: z.string().min(1, "Public statement is required"),
        expiresInDays: z.number().min(1).max(365).default(30)
      }).parse(req.body);

      const patientDID = (req.user as any).patientDID;
      const zkpService = await ZKPService.getInstance();
      
      const result = await zkpService.generateAllergyProof(
        patientDID,
        allergy,
        publicStatement,
        expiresInDays
      );

      res.json({
        success: true,
        proofId: result.proofId,
        message: "ZKP allergy proof generated successfully",
        publicStatement,
        expiresInDays
      });

    } catch (error: any) {
      console.error("ZKP allergy proof generation failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Verify ZKP proof (for hospitals)
  app.post("/api/zkp/verify-proof", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const { proofId, verificationContext, emergencyAccess } = z.object({
        proofId: z.number().positive(),
        verificationContext: z.string().min(1, "Verification context is required"),
        emergencyAccess: z.boolean().default(false)
      }).parse(req.body);

      const user = req.user!;
      const zkpService = await ZKPService.getInstance();
      
      const result = await zkpService.verifyProof(
        proofId,
        user.id,
        user.hospitalName,
        verificationContext,
        emergencyAccess
      );

      if (result.isValid) {
        res.json({
          success: true,
          message: "ZKP proof verified successfully",
          verificationId: result.verificationId,
          verificationContext,
          emergencyAccess
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "ZKP proof verification failed"
        });
      }

    } catch (error: any) {
      console.error("ZKP proof verification failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get patient's ZKP proofs
  app.get("/api/zkp/patient-proofs", requirePatientAuth, async (req, res) => {
    try {
      const patientDID = (req.user as any).patientDID;
      const zkpService = await ZKPService.getInstance();
      const proofs = await zkpService.getPatientProofs(patientDID);

      res.json({
        success: true,
        proofs: proofs.map((proof: any) => ({
          id: proof.id,
          proofType: proof.proofType,
          publicStatement: proof.publicStatement,
          expiresAt: proof.expiresAt,
          isActive: proof.isActive,
          verificationCount: proof.verificationCount,
          createdAt: proof.createdAt
        }))
      });

    } catch (error: any) {
      console.error("Failed to get patient ZKP proofs:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Revoke ZKP proof
  app.post("/api/zkp/revoke-proof", requirePatientAuth, async (req, res) => {
    try {
      const { proofId } = z.object({
        proofId: z.number().positive()
      }).parse(req.body);

      const patientDID = (req.user as any).patientDID;
      const zkpService = await ZKPService.getInstance();
      
      const success = await zkpService.revokeProof(proofId, patientDID);

      if (success) {
        res.json({
          success: true,
          message: "ZKP proof revoked successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to revoke ZKP proof"
        });
      }

    } catch (error: any) {
      console.error("ZKP proof revocation failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Emergency ZKP verification (no authentication required for emergency access)
  app.post("/api/zkp/emergency-verify", async (req, res) => {
    try {
      const { proofId, verificationContext, emergencyType } = z.object({
        proofId: z.number().positive(),
        verificationContext: z.string().min(1, "Verification context is required"),
        emergencyType: z.enum(['LIFE_THREATENING', 'UNCONSCIOUS_PATIENT', 'CRITICAL_CARE'])
      }).parse(req.body);

      const zkpService = await ZKPService.getInstance();
      
      // For emergency access, we use a system user ID (999)
      const result = await zkpService.verifyProof(
        proofId,
        999, // System user for emergency access
        "EMERGENCY_SYSTEM",
        verificationContext,
        true // emergencyAccess = true
      );

      if (result.isValid) {
        res.json({
          success: true,
          message: "Emergency ZKP verification successful",
          verificationId: result.verificationId,
          emergencyType,
          verificationContext
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Emergency ZKP verification failed"
        });
      }

    } catch (error: any) {
      console.error("Emergency ZKP verification failed:", error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
} 