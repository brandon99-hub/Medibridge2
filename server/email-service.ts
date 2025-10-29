import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Configure Nodemailer transporter
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    // Use Gmail or custom SMTP
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      // Fallback to console logging in development
      console.log('[EMAIL] No email configuration found, using console logging');
    }
  }
  return transporter!;
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
      
      const htmlContent = `
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
      `;

      const textContent = `
        MediBridge Healthcare System
        
        Your OTP code for authentication is: ${otpCode}
        
        This code will expire in ${expiresInMinutes} minutes.
        
        If you didn't request this code, please ignore this email.
      `;

      const transport = getTransporter();
      
      if (transport) {
        await transport.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to,
          subject: 'MediBridge - Your OTP Code',
          html: htmlContent,
          text: textContent,
        });
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
      });
      
      // Fallback to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV FALLBACK] OTP for ${data.to}: ${data.otpCode}`);
        return true;
      }
      
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, patientDID: string): Promise<boolean> {
    try {
      const htmlContent = `
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
      `;

      const transport = getTransporter();
      
      if (transport) {
        await transport.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to,
          subject: 'Welcome to MediBridge - Your Digital Identity is Ready',
          html: htmlContent,
        });
        console.log(`[EMAIL SENT] Welcome email sent to ${to}`);
        return true;
      } else {
        console.log(`[DEV MODE] Welcome email would be sent to ${to}`);
        return true;
      }
    } catch (error) {
      console.error('[EMAIL ERROR]', error);
      // Fallback in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV FALLBACK] Welcome email for ${to}`);
        return true;
      }
      return false;
    }
  }

  async sendEmergencyConsentEmail(data: EmergencyConsentEmailData): Promise<boolean> {
    try {
      const { to, nextOfKinName, patientRelationship, verificationCode, emergencyType, hospitalName, contactPhone } = data;
      
      const htmlContent = `
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
      `;

      const textContent = `
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
      `;

      const transport = getTransporter();
      
      if (transport) {
        await transport.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to,
          subject: `URGENT: Emergency Medical Consent Required - ${hospitalName}`,
          html: htmlContent,
          text: textContent,
        });
        console.log(`[EMERGENCY EMAIL SENT] Emergency consent request sent to ${to}: ${verificationCode}`);
        return true;
      } else {
        console.log(`[DEV MODE] Emergency consent email would be sent to ${to} with code: ${verificationCode}`);
        return true;
      }
    } catch (error: any) {
      console.error('[EMERGENCY EMAIL ERROR]', error);
      // Fallback in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV FALLBACK] Emergency email for ${data.to} with code: ${data.verificationCode}`);
        return true;
      }
      throw error;
    }
  }
}

export const emailService = EmailService.getInstance(); 