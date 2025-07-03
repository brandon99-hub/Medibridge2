// ZK-MedPass Routes - NEW routes that don't modify existing functionality
import type { Express } from "express";
import { z } from "zod";
import { africasTalkingService } from "./africas-talking-service";
import { zkpService } from "./zkp-service";
import { smsService } from "./sms-service";
import { auditService } from "./audit-service";
import { storage } from "./storage";

const demoProofStore: { [code: string]: any } = {};

export function registerZKMedPassRoutes(app: Express) {
  
  // USSD Webhook - Africa's Talking calls this
  app.post("/api/ussd", async (req, res) => {
    try {
      const { sessionId, phoneNumber, text, serviceCode } = req.body;
      
      const ussdResponse = await africasTalkingService.handleUSSD({
        sessionId,
        phoneNumber,
        text: text || '',
        serviceCode
      });
      
      res.set('Content-Type', 'text/plain');
      res.send(ussdResponse);
      
    } catch (error: any) {
      console.error('USSD Error:', error);
      res.set('Content-Type', 'text/plain');
      res.send('END Sorry, service temporarily unavailable.');
    }
  });

  // Generate generic ZK proof for any claim (MOCKED FOR DEMO)
  app.post("/api/zk-medpass/generate-proof", async (req, res) => {
    try {
      // For demo, use hardcoded or request values
      const patientName = req.body.patientName || "John Doe";
      const claimType = req.body.claimType || "Insurance";
      const claimValue = req.body.claimValue || "Yes";
      const claimDate = req.body.claimDate || new Date().toISOString().slice(0, 10);
      // Generate a random 6-digit code
      const proofCode = Math.floor(100000 + Math.random() * 900000).toString();
      const proofId = "mock-proof-" + proofCode;

      // Store in memory for verifier
      demoProofStore[proofCode] = {
        proofId,
        patientName,
        claimType,
        claimValue,
        claimDate,
        proofCode
      };

      // Send SMS
      await smsService.sendOTPSMS({
        to: "+254741991213",
        otpCode: `Your verification code is ${proofCode} for patient ${patientName}, claim: ${claimType} = ${claimValue}.`,
        expiresInMinutes: 30
      });

      // Return proof object
      return res.json({
        proofId,
        patientName,
        claimType,
        claimValue,
        claimDate,
        proofCode,
        message: "Share this code with the doctor. The doctor will enter it in the verifier to confirm your claim."
      });
    } catch (error: any) {
      return res.status(400).json({ error: `Failed to generate demo proof: ${error.message}` });
    }
  });

  // Share ZK proof via SMS
  app.post("/api/zk-medpass/share-proof", async (req, res) => {
    try {
      const { proofId, recipientPhone, recipientType } = z.object({
        proofId: z.number(),
        recipientPhone: z.string(),
        recipientType: z.enum(['partner', 'employer', 'clinic', 'emergency'])
      }).parse(req.body);

      const proof = await storage.getZKPProofById(proofId);
      if (!proof) {
        return res.status(404).json({ error: 'Proof not found' });
      }

      // Create anonymous message
      const message = `ZK-MedPass: Patient verified as ${proof.publicStatement}. No personal information shared.`;

      // Send via existing SMS service
      await smsService.sendOTPSMS({
        to: recipientPhone,
        otpCode: message,
        expiresInMinutes: 1440
      });

      // Log the sharing
      await auditService.logEvent({
        eventType: "ZKP_PROOF_SHARED",
        actorType: "PATIENT",
        actorId: proof.patientDID,
        targetType: "ZKP_PROOF",
        targetId: proofId.toString(),
        action: "SHARE",
        outcome: "SUCCESS",
        metadata: {
          recipientType,
          recipientPhone: recipientPhone.replace(/\d(?=\d{4})/g, '*') // Mask phone
        },
        severity: "info",
      });

      res.json({
        success: true,
        message: 'Proof shared successfully'
      });

    } catch (error: any) {
      res.status(400).json({ error: `Failed to share proof: ${error.message}` });
    }
  });

  // Emergency mode - rapid proof sharing
  app.post("/api/zk-medpass/emergency", async (req, res) => {
    try {
      const { patientDID, emergencyContacts } = z.object({
        patientDID: z.string(),
        emergencyContacts: z.array(z.string())
      }).parse(req.body);

      // Get patient's emergency proof
      const zkpServiceInstance = await zkpService;
      const proofs = await zkpServiceInstance.getPatientProofs(patientDID);
      const emergencyProof = proofs.find((p: any) => p.proofType === 'emergency' || p.publicStatement.includes('emergency'));

      if (!emergencyProof) {
        return res.status(404).json({ error: 'No emergency proof found' });
      }

      // Send SMS and voice calls to emergency contacts
      for (const contact of emergencyContacts) {
        // SMS
        await smsService.sendOTPSMS({
          to: contact,
          otpCode: 'URGENT: Patient has valid health proof. Emergency treatment authorized.',
          expiresInMinutes: 60
        });

        // Voice call
        await africasTalkingService.makeVoiceCall({
          to: contact,
          message: 'Mgonjwa huyu amethibitishwa. Anaweza kupokea huduma ya afya ya dharura.',
          language: 'swahili'
        });
      }

      res.json({
        success: true,
        message: 'Emergency mode activated'
      });

    } catch (error: any) {
      res.status(400).json({ error: `Emergency mode failed: ${error.message}` });
    }
  });

  // Submit feedback and earn airtime
  app.post("/api/zk-medpass/feedback", async (req, res) => {
    try {
      const { phoneNumber, rating, feedback } = z.object({
        phoneNumber: z.string(),
        rating: z.number().min(1).max(5),
        feedback: z.string().optional()
      }).parse(req.body);

      // Store feedback
      await storage.createFeedback({
        phoneNumber,
        rating,
        feedback: feedback || '',
        submittedAt: new Date()
      });

      // Send airtime reward (10 KES)
      await africasTalkingService.sendAirtime({
        to: phoneNumber,
        amount: 10
      });

      res.json({
        success: true,
        message: 'Feedback submitted. 10 KES airtime sent!'
      });

    } catch (error: any) {
      res.status(400).json({ error: `Feedback submission failed: ${error.message}` });
    }
  });

  // Get ZK-MedPass analytics (for NGO dashboard)
  app.get("/api/zk-medpass/analytics", async (req, res) => {
    try {
      // Get aggregated data (no PII)
      const totalProofs = await storage.getTotalZKPProofs();
      const activeProofs = await storage.getActiveZKPProofs();
      const expiringProofs = await storage.getExpiringZKPProofs(7); // 7 days

      res.json({
        success: true,
        analytics: {
          totalProofs,
          activeProofs,
          expiringProofs,
          proofTypes: {
            hiv: await storage.getProofCountByType('condition'),
            vaccination: await storage.getProofCountByType('vaccination'),
            insurance: await storage.getProofCountByType('insurance')
          }
        }
      });

    } catch (error: any) {
      res.status(400).json({ error: `Analytics failed: ${error.message}` });
    }
  });

  app.post("/api/zk-medpass/verify-code", async (req, res) => {
    const { code } = req.body;
    if (demoProofStore[code]) {
      return res.json({ valid: true, ...demoProofStore[code] });
    } else {
      return res.json({ valid: false });
    }
  });
} 