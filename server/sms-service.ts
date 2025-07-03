// SMS service with multiple provider support (no Twilio dependency)

// Configure SMS services - Multiple providers for redundancy
const msg91ApiKey = process.env.MSG91_API_KEY;
const msg91Sender = process.env.MSG91_SENDER || 'MEDIBR';

// Vonage (formerly Nexmo) - Pay as you go
const vonageApiKey = process.env.VONAGE_API_KEY;
const vonageApiSecret = process.env.VONAGE_API_SECRET;
const vonageFromNumber = process.env.VONAGE_FROM_NUMBER;

// AWS SNS - Very low cost
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const awsSnsFromNumber = process.env.AWS_SNS_FROM_NUMBER;

// SendGrid SMS - Low cost
const sendGridApiKey = process.env.SENDGRID_API_KEY;
const sendGridFromNumber = process.env.SENDGRID_FROM_NUMBER;

// Plivo - Competitive pricing
const plivoAuthId = process.env.PLIVO_AUTH_ID;
const plivoAuthToken = process.env.PLIVO_AUTH_TOKEN;
const plivoFromNumber = process.env.PLIVO_FROM_NUMBER;

// Remove Twilio dependency - no longer needed

import { africasTalkingService } from "./africas-talking-service";
const africasTalkingSenderId = process.env.AFRICAS_TALKING_SENDER_ID || undefined;

export interface SMSOTPData {
  to: string;
  otpCode: string;
  expiresInMinutes: number;
}

export interface EmergencyConsentSMSData {
  to: string;
  nextOfKinName: string;
  patientRelationship: string;
  verificationCode: string;
  emergencyType: string;
  hospitalName: string;
}

export interface WelcomeSMSData {
  to: string;
  patientDID: string;
}

class SMSService {
  private static instance: SMSService;

  private constructor() {}

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  /**
   * Send OTP via SMS using Africa's Talking only
   */
  async sendOTPSMS(data: SMSOTPData): Promise<void> {
    const message = `Your MediBridge verification code is: ${data.otpCode}. Valid for ${data.expiresInMinutes} minutes. Do not share this code with anyone.`;
    await africasTalkingService.sendSMS(data.to, message, africasTalkingSenderId);
    console.log(`[SMSService] OTP SMS sent via Africa's Talking to ${data.to}`);
  }

  /**
   * Send emergency consent notification via SMS
   */
  async sendEmergencyConsentSMS(data: EmergencyConsentSMSData): Promise<void> {
    const message = `URGENT: ${data.nextOfKinName}, you are listed as ${data.patientRelationship} for a patient requiring emergency medical care at ${data.hospitalName}. Verification code: ${data.verificationCode}. Please respond immediately.`;

    // Use the same service selection logic as OTP
    if (msg91ApiKey) {
      try {
        await this.sendViaMSG91(data.to, message);
        console.log(`[SMSService] Emergency consent SMS sent via MSG91 to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] MSG91 failed: ${error.message}`);
      }
    }

    // Try alternative providers for emergency consent
    if (vonageApiKey && vonageApiSecret && vonageFromNumber) {
      try {
        await this.sendViaVonage(data.to, message);
        console.log(`[SMSService] Emergency consent SMS sent via Vonage to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Vonage failed: ${error.message}`);
      }
    }

    if (awsAccessKeyId && awsSecretAccessKey && awsSnsFromNumber) {
      try {
        await this.sendViaAWSSNS(data.to, message);
        console.log(`[SMSService] Emergency consent SMS sent via AWS SNS to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] AWS SNS failed: ${error.message}`);
      }
    }

    if (sendGridApiKey && sendGridFromNumber) {
      try {
        await this.sendViaSendGrid(data.to, message);
        console.log(`[SMSService] Emergency consent SMS sent via SendGrid to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] SendGrid failed: ${error.message}`);
      }
    }

    if (plivoAuthId && plivoAuthToken && plivoFromNumber) {
      try {
        await this.sendViaPlivo(data.to, message);
        console.log(`[SMSService] Emergency consent SMS sent via Plivo to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Plivo failed: ${error.message}`);
      }
    }

    throw new Error('No SMS service configured for emergency consent');
  }

  /**
   * Send welcome SMS for new patients
   */
  async sendWelcomeSMS(data: WelcomeSMSData): Promise<void> {
    const message = `Welcome to MediBridge! Your patient DID is: ${data.patientDID}. You can now securely access and manage your medical records.`;

    // Use the same service selection logic
    if (msg91ApiKey) {
      try {
        await this.sendViaMSG91(data.to, message);
        console.log(`[SMSService] Welcome SMS sent via MSG91 to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] MSG91 failed: ${error.message}`);
      }
    }

    // Try alternative providers for welcome SMS
    if (vonageApiKey && vonageApiSecret && vonageFromNumber) {
      try {
        await this.sendViaVonage(data.to, message);
        console.log(`[SMSService] Welcome SMS sent via Vonage to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Vonage failed: ${error.message}`);
      }
    }

    if (awsAccessKeyId && awsSecretAccessKey && awsSnsFromNumber) {
      try {
        await this.sendViaAWSSNS(data.to, message);
        console.log(`[SMSService] Welcome SMS sent via AWS SNS to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] AWS SNS failed: ${error.message}`);
      }
    }

    if (sendGridApiKey && sendGridFromNumber) {
      try {
        await this.sendViaSendGrid(data.to, message);
        console.log(`[SMSService] Welcome SMS sent via SendGrid to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] SendGrid failed: ${error.message}`);
      }
    }

    if (plivoAuthId && plivoAuthToken && plivoFromNumber) {
      try {
        await this.sendViaPlivo(data.to, message);
        console.log(`[SMSService] Welcome SMS sent via Plivo to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Plivo failed: ${error.message}`);
      }
    }

    // Don't throw error for welcome SMS as it's not critical
    console.warn('[SMSService] No SMS service configured for welcome message');
  }

  /**
   * Check if SMS service is configured
   */
  isConfigured(): boolean {
    return !!(msg91ApiKey || vonageApiKey || awsAccessKeyId || sendGridApiKey || plivoAuthId);
  }

  /**
   * Get configured SMS service info
   */
  getServiceInfo(): string {
    if (msg91ApiKey) return 'MSG91';
    if (vonageApiKey) return 'Vonage';
    if (awsAccessKeyId) return 'AWS SNS';
    if (sendGridApiKey) return 'SendGrid';
    if (plivoAuthId) return 'Plivo';
    return 'None';
  }
}

export const smsService = SMSService.getInstance(); 