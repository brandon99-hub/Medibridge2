import sgMail from '@sendgrid/mail';

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailOTPData {
  to: string;
  otpCode: string;
  expiresInMinutes: number;
}

export interface EmergencyConsentEmailData {
  to: string;
  nextOfKinName: string;
  patientRelationship: string;
  verificationCode: string;
  emergencyType: string;
  hospitalName: string;
  contactPhone: string;
}

export class EmailService {
  private static instance: EmailService;
  
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendOTPEmail(data: EmailOTPData): Promise<boolean> {
    try {
      const { to, otpCode, expiresInMinutes } = data;
      
      const msg = {
        to,
        from: 'brandmwenja@gmail.com', // Use your verified email address
        subject: 'MediBridge - Your OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">MediBridge Healthcare System</h2>
            <p>Your OTP code for authentication is:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 4px; margin: 0;">${otpCode}</h1>
            </div>
            <p><strong>This code will expire in ${expiresInMinutes} minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated message from MediBridge Healthcare System.
            </p>
          </div>
        `,
        text: `
          MediBridge Healthcare System
          
          Your OTP code for authentication is: ${otpCode}
          
          This code will expire in ${expiresInMinutes} minutes.
          
          If you didn't request this code, please ignore this email.
        `
      };

      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here') {
        await sgMail.send(msg);
        console.log(`[EMAIL SENT] OTP sent to ${to}: ${otpCode}`);
        return true;
      } else {
        // Fallback to console logging in development
        console.log(`[EMAIL OTP] ${to}: ${otpCode}`);
        console.log(`[DEV MODE] Email would be sent to ${to} with OTP: ${otpCode}`);
        return true;
      }
    } catch (error: any) {
      console.error('[EMAIL ERROR]', error);
      console.error('[EMAIL ERROR DETAILS]', {
        code: error.code,
        message: error.message,
        response: error.response?.body,
        status: error.response?.statusCode
      });
      // Don't fallback - show the real error
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, patientDID: string): Promise<boolean> {
    try {
      const msg = {
        to,
        from: 'brandmwenja@gmail.com', // Use your verified email address
        subject: 'Welcome to MediBridge - Your Digital Identity is Ready',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to MediBridge!</h2>
            <p>Your digital identity has been successfully created.</p>
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Your Digital Identity (DID):</strong></p>
              <code style="background-color: #e5e7eb; padding: 8px; border-radius: 4px; font-family: monospace;">${patientDID}</code>
            </div>
            <p>You can now:</p>
            <ul>
              <li>Access your medical records securely</li>
              <li>Grant consent to healthcare providers</li>
              <li>Manage your privacy settings</li>
            </ul>
            <p>Thank you for choosing MediBridge for your healthcare needs!</p>
          </div>
        `
      };

      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here') {
        await sgMail.send(msg);
        return true;
      } else {
        console.log(`[DEV MODE] Welcome email would be sent to ${to}`);
        return true;
      }
    } catch (error) {
      console.error('[EMAIL ERROR]', error);
      return false;
    }
  }

  async sendEmergencyConsentEmail(data: EmergencyConsentEmailData): Promise<boolean> {
    try {
      const { to, nextOfKinName, patientRelationship, verificationCode, emergencyType, hospitalName, contactPhone } = data;
      
      const msg = {
        to,
        from: 'brandmwenja@gmail.com',
        subject: `URGENT: Emergency Medical Consent Required - ${hospitalName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🚨 EMERGENCY MEDICAL CONSENT REQUIRED</h2>
            <p><strong>Dear ${nextOfKinName},</strong></p>
            <p>This is an urgent notification from ${hospitalName} regarding a medical emergency involving your ${patientRelationship}.</p>
            
            <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #dc2626; margin-top: 0;">Emergency Details:</h3>
              <p><strong>Emergency Type:</strong> ${emergencyType}</p>
              <p><strong>Hospital:</strong> ${hospitalName}</p>
              <p><strong>Contact Phone:</strong> ${contactPhone}</p>
            </div>
            
            <p>To provide consent for emergency medical treatment, please use the following verification code:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 4px; margin: 0;">${verificationCode}</h1>
            </div>
            
            <p><strong>Please contact the hospital immediately with this verification code to provide consent.</strong></p>
            
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af;"><strong>Important:</strong> This consent is required for emergency medical treatment. Time is critical.</p>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated emergency notification from ${hospitalName}.
            </p>
          </div>
        `,
        text: `
          URGENT: Emergency Medical Consent Required - ${hospitalName}
          
          Dear ${nextOfKinName},
          
          This is an urgent notification from ${hospitalName} regarding a medical emergency involving your ${patientRelationship}.
          
          Emergency Details:
          - Emergency Type: ${emergencyType}
          - Hospital: ${hospitalName}
          - Contact Phone: ${contactPhone}
          
          To provide consent for emergency medical treatment, please use the following verification code:
          
          ${verificationCode}
          
          Please contact the hospital immediately with this verification code to provide consent.
          
          Important: This consent is required for emergency medical treatment. Time is critical.
          
          This is an automated emergency notification from ${hospitalName}.
        `
      };

      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here') {
        await sgMail.send(msg);
        console.log(`[EMERGENCY EMAIL SENT] Emergency consent request sent to ${to}: ${verificationCode}`);
        return true;
      } else {
        console.log(`[DEV MODE] Emergency consent email would be sent to ${to} with code: ${verificationCode}`);
        return true;
      }
    } catch (error: any) {
      console.error('[EMERGENCY EMAIL ERROR]', error);
      throw error;
    }
  }
}

export const emailService = EmailService.getInstance(); 