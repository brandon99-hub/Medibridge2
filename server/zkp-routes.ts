import express from 'express';
import { zkpService } from './zkp-service';
import { requirePatientAuth } from './patient-auth-middleware';
import { requireAdminAuth } from './admin-auth-middleware';
import { rateLimiters } from './rate-limiting-service';
import { auditService } from './audit-service';
import { smsService } from './sms-service';
import { storage } from './storage';
import { z } from 'zod';

const router = express.Router();

// Rate limiter for ZKP operations
const zkpRateLimiter = rateLimiters.medicalRecords;

// Extend Request interface for patient authentication
declare global {
  namespace Express {
    interface Request {
      patientDID?: string;
    }
  }
}

/**
 * USSD endpoint for patient proof access
 * POST /api/zkp/ussd
 */
router.post('/ussd', async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    if (!sessionId || !serviceCode || !phoneNumber) {
      return res.status(400).json({ error: "Missing required USSD parameters" });
    }

    // Simple USSD menu for proof access
    let response = "";
    
    if (!text || text === "") {
      response = "CON Welcome to MediBridge\n1. Access my medical proofs\n2. Share proof with hospital\n3. Check proof status\n4. Emergency access";
    } else if (text === "1") {
      response = "CON Enter your verification code:";
    } else if (text === "2") {
      response = "CON Enter hospital code:";
    } else if (text === "3") {
      response = "CON Enter proof ID:";
    } else if (text === "4") {
      response = "CON Emergency access requires hospital authorization. Please visit the hospital.";
    } else {
      response = "END Invalid option. Please try again.";
    }

    res.json({
      sessionId,
      serviceCode,
      phoneNumber,
      text,
      response
    });

  } catch (error: any) {
    console.error('USSD error:', error);
    res.status(500).json({ error: "USSD service error" });
  }
});

/**
 * Voice call endpoint for patient proof access
 * POST /api/zkp/voice-call
 */
router.post('/voice-call', async (req, res) => {
  try {
    const { phoneNumber, proofId, verificationCode } = req.body;

    if (!phoneNumber || !proofId || !verificationCode) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Simulate voice call for proof access
    const callResponse = {
      success: true,
      callId: `call_${Date.now()}`,
      message: `Voice call initiated to ${phoneNumber} for proof ${proofId}`,
      instructions: "Patient will receive automated voice instructions for proof access"
    };

    res.json(callResponse);

  } catch (error: any) {
    console.error('Voice call error:', error);
    res.status(500).json({ error: "Voice call service error" });
  }
});

/**
 * Send airtime reward for proof sharing
 * POST /api/zkp/send-airtime
 */
router.post('/send-airtime', async (req, res) => {
  try {
    const { phoneNumber, amount, reason } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Simulate airtime sending
    const airtimeResponse = {
      success: true,
      transactionId: `airtime_${Date.now()}`,
      message: `Airtime reward of ${amount} sent to ${phoneNumber}`,
      reason: reason || "Proof sharing reward"
    };

    res.json(airtimeResponse);

  } catch (error: any) {
    console.error('Airtime sending error:', error);
    res.status(500).json({ error: "Airtime service error" });
  }
});

/**
 * Share ZK proof via SMS
 * POST /api/zkp/share-proof
 */
router.post('/share-proof', async (req, res) => {
  try {
    const { proofId, recipientPhone, recipientType } = z.object({
      proofId: z.number(),
      recipientPhone: z.string(),
      recipientType: z.enum(['partner', 'employer', 'clinic', 'emergency'])
    }).parse(req.body);

    const proof = await storage.getZKPProof(proofId);
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    const message = `MediBridge: Patient verified as ${proof.publicStatement}. No personal information shared.`;

    await smsService.sendOTPSMS({
      to: recipientPhone,
      otpCode: message,
      expiresInMinutes: 1440
    });

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
        recipientPhone: recipientPhone.replace(/\d(?=\d{4})/g, '*')
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

/**
 * Emergency mode - bypass verification for urgent care
 * POST /api/zkp/emergency-mode
 */
router.post('/emergency-mode', async (req, res) => {
  try {
    const { patientDID, emergencyContact, hospitalId } = req.body;

    if (!patientDID || !emergencyContact || !hospitalId) {
      return res.status(400).json({ error: "Missing required emergency parameters" });
    }

    // Log emergency access
    await auditService.logEvent({
      eventType: "EMERGENCY_ACCESS_GRANTED",
      actorType: "HOSPITAL",
      actorId: hospitalId,
      targetType: "PATIENT",
      targetId: patientDID,
      action: "EMERGENCY_ACCESS",
      outcome: "SUCCESS",
      metadata: {
        emergencyContact,
        timestamp: new Date().toISOString()
      },
      severity: "high",
    });

    // Send SMS to emergency contact
    await smsService.sendOTPSMS({
      to: emergencyContact,
      otpCode: 'URGENT: Patient has valid health proof. Emergency treatment authorized.',
      expiresInMinutes: 60
    });

    // Simulate voice call
    const voiceCallResponse = {
      success: true,
      callId: `emergency_call_${Date.now()}`,
      message: 'Emergency voice call initiated',
      language: 'swahili'
    };

    res.json({
      success: true,
      message: 'Emergency mode activated',
      voiceCall: voiceCallResponse
    });

  } catch (error: any) {
    res.status(400).json({ error: `Emergency mode failed: ${error.message}` });
  }
});

/**
 * Submit feedback and earn airtime
 * POST /api/zkp/feedback
 */
router.post('/feedback', async (req, res) => {
  try {
    const { phoneNumber, rating, feedback } = req.body;

    if (!phoneNumber || !rating) {
      return res.status(400).json({ error: "Phone number and rating are required" });
    }

    await storage.createFeedback({
      phoneNumber,
      rating,
      feedback: feedback || '',
      submittedAt: new Date()
    });

    // Simulate airtime sending
    const airtimeResponse = {
      success: true,
      transactionId: `feedback_airtime_${Date.now()}`,
      amount: 10,
      message: '10 KES airtime sent as feedback reward'
    };

    res.json({
      success: true,
      message: 'Feedback submitted. 10 KES airtime sent!',
      airtime: airtimeResponse
    });

  } catch (error: any) {
    res.status(400).json({ error: `Feedback submission failed: ${error.message}` });
  }
});

/**
 * Generate ZK proofs from actual medical form data
 * POST /api/zkp/generate-proofs-from-form
 */
router.post('/generate-proofs-from-form', async (req, res) => {
  try {
    const { patientDID, formData } = req.body;
    console.log('[ZKP] Received request to generate proofs from form:', { patientDID, formData });
    
    if (!patientDID || !formData) {
      console.error('[ZKP] Missing patientDID or formData:', { patientDID, formData });
      return res.status(400).json({ error: "Patient DID and form data are required" });
    }
    
    // Validate that patientDID is not empty or mock
    if (patientDID === "" || patientDID.includes("MOCKDID")) {
      console.error('[ZKP] Invalid patientDID:', patientDID);
      return res.status(400).json({ error: "Invalid patient DID. Please ensure the patient record was submitted successfully." });
    }

    const zkpServiceInstance = await zkpService;
    console.log('[ZKP] Analyzing medical data for patientDID:', patientDID);
    const analysis = await zkpServiceInstance.analyzeMedicalData(formData);
    console.log('[ZKP] Analysis result:', analysis);
    console.log('[ZKP] Generating proofs for patientDID:', patientDID);
    const proofs = await zkpServiceInstance.generateProofsFromMedicalData(
      patientDID,
      formData,
      analysis
    );
    console.log('[ZKP] Proofs generated:', proofs);

    const visitCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (formData.phoneNumber) {
      console.log('[ZKP] Sending SMS to:', formData.phoneNumber, 'with visitCode:', visitCode);
      try {
        await smsService.sendOTPSMS({
          to: formData.phoneNumber,
          otpCode: `MediBridge: Hello${formData.patientName ? ' ' + formData.patientName : ''}, your medical proofs for your recent hospital visit are ready!\nYour code: ${visitCode}\nValid for 30 days.\nTo retrieve or share your proofs, dial *123#.`,
          expiresInMinutes: 43200
        });
        console.log('[ZKP] SMS sent successfully to:', formData.phoneNumber);
      } catch (smsError) {
        console.error('[ZKP] Failed to send SMS:', smsError);
        // Don't fail the entire request if SMS fails
      }
    } else {
      console.log('[ZKP] No phone number provided, skipping SMS');
    }

    await auditService.logEvent({
      eventType: "ZKP_PROOFS_GENERATED_FROM_FORM",
      actorType: "HOSPITAL",
      actorId: "hospital-a",
      targetType: "PATIENT",
      targetId: formData.nationalId || "unknown",
      action: "GENERATE_PROOFS",
      outcome: "SUCCESS",
      metadata: {
        patientDID,
        proofCount: proofs.length,
        proofTypes: proofs.map(p => p.type),
        visitCode,
        analysis: {
          requiresTreatment: analysis.requiresTreatment,
          requiresRest: analysis.requiresRest,
          requiresMedication: analysis.requiresMedication,
          isContagious: analysis.isContagious,
          severity: analysis.severity
        }
      },
      severity: "info",
    });

    res.json({
      success: true,
      visitCode,
      proofs,
      analysis,
      message: `All proofs for this visit are bundled under code ${visitCode}`
    });

  } catch (error: any) {
    console.error('[ZKP] Error generating proofs from form:', error, '\nRequest body:', req.body);
    res.status(400).json({ error: `Failed to generate proofs: ${error.message}` });
  }
});

/**
 * Analyze medical data and get proof suggestions
 * POST /api/zkp/analyze-medical-data
 */
router.post('/analyze-medical-data', async (req, res) => {
  try {
    const { formData } = req.body;
    
    if (!formData) {
      return res.status(400).json({ error: "Form data is required" });
    }

    const zkpServiceInstance = await zkpService;
    const analysis = await zkpServiceInstance.analyzeMedicalData(formData);
    const suggestions = await zkpServiceInstance.generateProofSuggestions(analysis);

    res.json({
      success: true,
      analysis,
      suggestions,
      message: "Medical data analyzed successfully"
    });

  } catch (error: any) {
    console.error('Error analyzing medical data:', error);
    res.status(400).json({ error: `Failed to analyze medical data: ${error.message}` });
  }
});

/**
 * Generate ZK proof for medical record
 * POST /api/zkp/generate-proof
 */
router.post('/generate-proof', zkpRateLimiter, requirePatientAuth, async (req, res) => {
  try {
    const {
      diagnosis,
      prescription,
      treatment,
      patientDID,
      doctorDID,
      hospitalDID,
      visitDate,
      expiresInDays = 30,
      selectiveDisclosure,
      timeBasedProof,
      patientPhoneNumber
    } = req.body;

    // Validate required fields
    if (!diagnosis || !prescription || !treatment || !patientDID || !doctorDID || !hospitalDID || !visitDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required medical record fields'
      });
    }

    // Validate patient authorization
    if (req.patientDID !== patientDID) {
      await auditService.logSecurityViolation({
        violationType: "UNAUTHORIZED_ZKP_GENERATION",
        severity: "high",
        details: {
          requestedPatientDID: patientDID,
          authenticatedPatientDID: req.patientDID
        }
      });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only generate proofs for your own records'
      });
    }

    // Phone number is required for patient access
    if (!patientPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Patient phone number is required for proof access'
      });
    }

    const medicalData = {
      diagnosis,
      prescription,
      treatment,
      patientDID,
      doctorDID,
      hospitalDID,
      visitDate: parseInt(visitDate)
    };

    const zkpServiceInstance = await zkpService;
    const result = await zkpServiceInstance.generateMedicalRecordProof(
      medicalData,
      expiresInDays,
      selectiveDisclosure,
      timeBasedProof,
      patientPhoneNumber
    );

    res.json({
      success: true,
      proofId: result.proofId,
      proofData: result.proofData,
      verificationCode: result.verificationCode,
      message: 'ZK proof generated successfully. Patient will receive SMS with verification code.'
    });

  } catch (error: any) {
    console.error('ZKP generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate ZK proof'
    });
  }
});

/**
 * Generate selective disclosure proof
 * POST /api/zkp/generate-selective-proof
 */
router.post('/generate-selective-proof', zkpRateLimiter, requirePatientAuth, async (req, res) => {
  try {
    const {
      diagnosis,
      prescription,
      treatment,
      patientDID,
      doctorDID,
      hospitalDID,
      visitDate,
      disclosure,
      expiresInDays = 30
    } = req.body;

    // Validate required fields
    if (!diagnosis || !prescription || !treatment || !patientDID || !doctorDID || !hospitalDID || !visitDate || !disclosure) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for selective disclosure proof'
      });
    }

    // Validate patient authorization
    if (req.session?.patientDID !== patientDID) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only generate proofs for your own records'
      });
    }

    const medicalData = {
      diagnosis: diagnosis || '',
      prescription: prescription || '',
      treatment: treatment || '',
      patientDID,
      doctorDID: doctorDID || '',
      hospitalDID: hospitalDID || '',
      visitDate: parseInt(visitDate)
    };

    const zkpServiceInstance = await zkpService;
    const result = await zkpServiceInstance.generateSelectiveProof(
      medicalData,
      disclosure,
      expiresInDays
    );

    res.json({
      success: true,
      proofId: result.proofId,
      proofData: result.proofData,
      message: 'Selective disclosure ZK proof generated successfully'
    });

  } catch (error: any) {
    console.error('Selective ZKP generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate selective ZK proof'
    });
  }
});

/**
 * Verify ZK proof
 * POST /api/zkp/verify-proof
 */
router.post('/verify-proof', zkpRateLimiter, async (req, res) => {
  try {
    const {
      proofId,
      verifiedBy,
      hospitalId,
      verificationContext,
      emergencyAccess = false,
      requestedDisclosure
    } = req.body;

    // Validate required fields
    if (!proofId || !verifiedBy || !hospitalId || !verificationContext) {
      return res.status(400).json({
        success: false,
        error: 'Missing required verification fields'
      });
    }

    const zkpServiceInstance = await zkpService;
    const result = await zkpServiceInstance.verifyProof(
      proofId,
      verifiedBy,
      hospitalId,
      verificationContext,
      emergencyAccess,
      requestedDisclosure
    );

    res.json({
      success: true,
      isValid: result.isValid,
      verificationId: result.verificationId,
      error: result.error,
      message: result.isValid ? 'ZK proof verified successfully' : 'ZK proof verification failed'
    });

  } catch (error: any) {
    console.error('ZKP verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify ZK proof'
    });
  }
});

/**
 * Batch verify multiple ZK proofs
 * POST /api/zkp/batch-verify
 */
router.post('/batch-verify', zkpRateLimiter, async (req, res) => {
  try {
    const {
      proofIds,
      verifiedBy,
      hospitalId,
      verificationContext
    } = req.body;

    // Validate required fields
    if (!proofIds || !Array.isArray(proofIds) || proofIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty proof IDs array'
      });
    }

    if (!verifiedBy || !hospitalId || !verificationContext) {
      return res.status(400).json({
        success: false,
        error: 'Missing required verification fields'
      });
    }

    // Limit batch size for performance
    if (proofIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Batch size too large. Maximum 50 proofs per batch.'
      });
    }

    const zkpServiceInstance = await zkpService;
    const results = await zkpServiceInstance.batchVerifyProofs(
      proofIds,
      verifiedBy,
      hospitalId,
      verificationContext
    );

    const validCount = results.filter((r: any) => r.result.isValid).length;
    const invalidCount = results.length - validCount;

    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        valid: validCount,
        invalid: invalidCount
      },
      message: `Batch verification completed: ${validCount} valid, ${invalidCount} invalid`
    });

  } catch (error: any) {
    console.error('Batch ZKP verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch verify ZK proofs'
    });
  }
});

/**
 * Get patient's ZK proofs
 * GET /api/zkp/patient-proofs/:patientDID
 */
router.get('/patient-proofs/:patientDID', zkpRateLimiter, requirePatientAuth, async (req, res) => {
  try {
    const { patientDID } = req.params;

    // Validate patient authorization
    if (req.session?.patientDID !== patientDID) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only access your own proofs'
      });
    }

    const zkpServiceInstance = await zkpService;
    const proofs = await zkpServiceInstance.getPatientProofs(patientDID);

    res.json({
      success: true,
      proofs,
      count: proofs.length,
      message: `Found ${proofs.length} ZK proofs for patient`
    });

  } catch (error: any) {
    console.error('Get patient proofs error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve patient proofs'
    });
  }
});

/**
 * Revoke ZK proof
 * DELETE /api/zkp/revoke-proof/:proofId
 */
router.delete('/revoke-proof/:proofId', zkpRateLimiter, requirePatientAuth, async (req, res) => {
  try {
    const { proofId } = req.params;
    const { patientDID } = req.body;

    if (!patientDID) {
      return res.status(400).json({
        success: false,
        error: 'Patient DID is required'
      });
    }

    // Validate patient authorization
    if (req.session?.patientDID !== patientDID) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Can only revoke your own proofs'
      });
    }

    const zkpServiceInstance = await zkpService;
    const success = await zkpServiceInstance.revokeProof(parseInt(proofId), patientDID);

    if (success) {
      res.json({
        success: true,
        message: 'ZK proof revoked successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Proof not found or already revoked'
      });
    }

  } catch (error: any) {
    console.error('Revoke proof error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke ZK proof'
    });
  }
});

/**
 * Get ZKP analytics (for admin dashboard)
 * GET /api/zkp/analytics
 */
router.get('/analytics', async (req, res) => {
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

/**
 * Get ZKP system statistics
 * GET /api/zkp/stats
 */
router.get('/stats', zkpRateLimiter, requireAdminAuth, async (req, res) => {
  try {
    const zkpServiceInstance = await zkpService;
    const cacheStats = zkpServiceInstance.getCacheStats();

    // Get proof statistics from database
    const totalProofs = await storage.getTotalZKPProofs();
    const activeProofs = await storage.getActiveZKPProofs();
    const expiringProofs = await storage.getExpiringZKPProofs(7); // Next 7 days

    res.json({
      success: true,
      stats: {
        cache: cacheStats,
        proofs: {
          total: totalProofs,
          active: activeProofs,
          expiring: expiringProofs
        }
      },
      message: 'ZKP system statistics retrieved successfully'
    });

  } catch (error: any) {
    console.error('Get ZKP stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve ZKP statistics'
    });
  }
});

/**
 * Clear ZKP cache
 * POST /api/zkp/clear-cache
 */
router.post('/clear-cache', zkpRateLimiter, requireAdminAuth, async (req, res) => {
  try {
    const zkpServiceInstance = await zkpService;
    zkpServiceInstance.clearCache();

    res.json({
      success: true,
      message: 'ZKP cache cleared successfully'
    });

  } catch (error: any) {
    console.error('Clear ZKP cache error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear ZKP cache'
    });
  }
});

export default router; 