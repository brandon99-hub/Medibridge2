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
   * Send OTP via SMS using available services
   */
  async sendOTPSMS(data: SMSOTPData): Promise<void> {
    const message = `Your MediBridge verification code is: ${data.otpCode}. Valid for ${data.expiresInMinutes} minutes. Do not share this code with anyone.`;

    // Try MSG91 (free tier available)
    if (msg91ApiKey) {
      try {
        await this.sendViaMSG91(data.to, message);
        console.log(`[SMSService] OTP SMS sent via MSG91 to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] MSG91 failed: ${error.message}`);
      }
    }

    // Try Vonage as fallback
    if (vonageApiKey && vonageApiSecret && vonageFromNumber) {
      try {
        await this.sendViaVonage(data.to, message);
        console.log(`[SMSService] OTP SMS sent via Vonage to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Vonage failed: ${error.message}`);
      }
    }

    // Try AWS SNS as fallback
    if (awsAccessKeyId && awsSecretAccessKey && awsSnsFromNumber) {
      try {
        await this.sendViaAWSSNS(data.to, message);
        console.log(`[SMSService] OTP SMS sent via AWS SNS to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] AWS SNS failed: ${error.message}`);
      }
    }

    // Try SendGrid SMS as fallback
    if (sendGridApiKey && sendGridFromNumber) {
      try {
        await this.sendViaSendGrid(data.to, message);
        console.log(`[SMSService] OTP SMS sent via SendGrid to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] SendGrid failed: ${error.message}`);
      }
    }

    // Try Plivo as fallback
    if (plivoAuthId && plivoAuthToken && plivoFromNumber) {
      try {
        await this.sendViaPlivo(data.to, message);
        console.log(`[SMSService] OTP SMS sent via Plivo to ${data.to}`);
        return;
      } catch (error: any) {
        console.warn(`[SMSService] Plivo failed: ${error.message}`);
      }
    }

    // Development mode - just log the OTP
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMSService] DEVELOPMENT MODE: OTP for ${data.to} is ${data.otpCode}`);
      return;
    }

    throw new Error('No SMS service configured or all services failed');
  }



  /**
   * Send SMS via MSG91 (free tier available)
   */
  private async sendViaMSG91(to: string, message: string): Promise<void> {
    const url = 'https://api.msg91.com/api/v5/flow/';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authkey': msg91ApiKey!,
      },
      body: JSON.stringify({
        flow_id: process.env.MSG91_FLOW_ID || 'your_flow_id',
        sender: msg91Sender,
        mobiles: to.replace('+', ''), // Remove + for MSG91
        VAR1: message,
      }),
    });

    const result = await response.json();
    if (result.type !== 'success') {
      throw new Error(`MSG91 error: ${result.message || 'Unknown error'}`);
    }
  }

  /**
   * Send SMS via Vonage (formerly Nexmo)
   */
  private async sendViaVonage(to: string, message: string): Promise<void> {
    const url = 'https://rest.nexmo.com/sms/json';
    const params = new URLSearchParams({
      api_key: vonageApiKey!,
      api_secret: vonageApiSecret!,
      from: vonageFromNumber!,
      to: to.replace('+', ''), // Remove + for Vonage
      text: message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const result = await response.json();
    if (result.messages?.[0]?.status !== '0') {
      throw new Error(`Vonage error: ${result.messages?.[0]?.['error-text'] || 'Unknown error'}`);
    }
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendViaAWSSNS(to: string, message: string): Promise<void> {
    const AWS = require('aws-sdk');
    const sns = new AWS.SNS({
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      region: awsRegion,
    });

    const params = {
      Message: message,
      PhoneNumber: to,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        }
      }
    };

    const result = await sns.publish(params).promise();
    if (!result.MessageId) {
      throw new Error('AWS SNS failed to send SMS');
    }
  }

  /**
   * Send SMS via SendGrid
   */
  private async sendViaSendGrid(to: string, message: string): Promise<void> {
    const url = 'https://api.sendgrid.com/v3/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { phone: sendGridFromNumber },
        to: [{ phone: to }],
        content: [{ type: 'text/plain', value: message }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${error}`);
    }
  }

  /**
   * Send SMS via Plivo
   */
  private async sendViaPlivo(to: string, message: string): Promise<void> {
    const url = `https://api.plivo.com/v1/Account/${plivoAuthId}/Message/`;
    const auth = Buffer.from(`${plivoAuthId}:${plivoAuthToken}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: plivoFromNumber,
        dst: to,
        text: message,
      }),
    });

    const result = await response.json();
    if (!result.message_uuid) {
      throw new Error(`Plivo error: ${result.error || 'Unknown error'}`);
    }
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