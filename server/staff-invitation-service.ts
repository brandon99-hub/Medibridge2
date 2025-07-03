import { storage } from "./storage";
import { emailService } from "./email-service";
import { auditService } from "./audit-service";
import { hashPassword } from "./auth";
import crypto from "crypto";
import { z } from "zod";

export interface StaffInvitationData {
  email: string;
  role: 'HOSPITAL_A_ONLY' | 'HOSPITAL_B_ONLY' | 'BOTH_A_B' | 'EMERGENCY_AUTHORIZER';
  department: string;
  name: string;
}

export interface InvitationResult {
  success: boolean;
  invitationId?: number;
  invitationToken?: string;
  error?: string;
}

export class StaffInvitationService {
  private static instance: StaffInvitationService;

  public static getInstance(): StaffInvitationService {
    if (!StaffInvitationService.instance) {
      StaffInvitationService.instance = new StaffInvitationService();
    }
    return StaffInvitationService.instance;
  }

  /**
   * Create staff invitation and send email
   */
  async createStaffInvitation(
    hospitalId: number,
    invitedBy: number,
    invitationData: StaffInvitationData
  ): Promise<InvitationResult> {
    try {
      // Validate hospital staff limit (max 4 staff + 1 admin = 5 total)
      const currentStaffCount = await this.getHospitalStaffCount(hospitalId);
      if (currentStaffCount >= 5) {
        return {
          success: false,
          error: "Hospital has reached maximum staff limit (4 staff + 1 admin)"
        };
      }

      // Check if email already has pending invitation
      const existingInvitation = await storage.getPendingInvitationByEmail(invitationData.email);
      if (existingInvitation) {
        return {
          success: false,
          error: "Email already has a pending invitation"
        };
      }

      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(invitationData.email);
      if (existingUser) {
        return {
          success: false,
          error: "A user with this email address already exists"
        };
      }

      // Generate invitation token
      const invitationToken = this.generateInvitationToken();
      
      // Set expiration (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create invitation record
      const invitation = await storage.createHospitalStaffInvitation({
        email: invitationData.email,
        hospitalId: hospitalId,
        invitedBy: invitedBy,
        role: invitationData.role,
        department: invitationData.department,
        invitationToken: invitationToken,
        status: 'pending',
        expiresAt: expiresAt,
      });

      // Generate temporary credentials
      const tempUsername = this.generateTemporaryUsername(invitationData.email);
      const tempPassword = this.generateTemporaryPassword();

      // Debug log to check hospitalId value and type
      console.log('[StaffInvitationService] Debug - hospitalId:', {
        value: hospitalId,
        type: typeof hospitalId,
        isNumber: typeof hospitalId === 'number',
        isInteger: Number.isInteger(hospitalId),
        isPositive: hospitalId > 0
      });

      // Create user account with temporary credentials
      const user = await storage.createUser({
        username: tempUsername,
        password: await hashPassword(tempPassword),
        hospitalName: await this.getHospitalName(hospitalId),
        hospitalType: this.getHospitalTypeFromRole(invitationData.role),
        email: invitationData.email,
        invitedBy: invitedBy,
        invitationExpiresAt: expiresAt,
        isInvitationActive: true,
        isAdmin: false,
        hospital_id: hospitalId,
      });

      // Send invitation email
      await this.sendInvitationEmail(invitationData.email, {
        hospitalName: await this.getHospitalName(hospitalId),
        role: invitationData.role,
        department: invitationData.department,
        username: tempUsername,
        temporaryPassword: tempPassword,
        invitationToken: invitationToken,
        expiresAt: expiresAt,
      });

      // Log the invitation
      await auditService.logEvent({
        eventType: "STAFF_INVITATION_CREATED",
        actorType: "HOSPITAL_ADMIN",
        actorId: invitedBy.toString(),
        targetType: "STAFF_INVITATION",
        targetId: invitation.id.toString(),
        action: "CREATE",
        outcome: "SUCCESS",
        metadata: {
          email: invitationData.email,
          role: invitationData.role,
          department: invitationData.department,
          invitationToken: invitationToken,
          expiresAt: expiresAt.toISOString(),
        },
        severity: "info",
      });

      return {
        success: true,
        invitationId: invitation.id,
        invitationToken: invitationToken,
      };

    } catch (error: any) {
      console.error('[StaffInvitationService] Create invitation failed:', error);
      
      await auditService.logSecurityViolation({
        violationType: "STAFF_INVITATION_CREATION_FAILURE",
        severity: "medium",
        actorId: invitedBy.toString(),
        targetResource: `hospital:${hospitalId}`,
        details: {
          error: error.message,
          email: invitationData.email,
        },
      });

      return {
        success: false,
        error: "Failed to create staff invitation"
      };
    }
  }

  /**
   * Accept invitation and activate account
   */
  async acceptInvitation(
    invitationToken: string,
    newPassword: string,
    name: string
  ): Promise<{ success: boolean; error?: string; userId?: number }> {
    try {
      // Validate invitation
      const invitation = await storage.getInvitationByToken(invitationToken);
      if (!invitation) {
        return { success: false, error: "Invalid invitation token" };
      }

      if (invitation.status !== 'pending') {
        return { success: false, error: "Invitation has already been used or expired" };
      }

      if (new Date() > invitation.expiresAt) {
        return { success: false, error: "Invitation has expired" };
      }

      // Find the user account
      const user = await storage.getUserByEmail(invitation.email);
      if (!user) {
        return { success: false, error: "User account not found" };
      }

      // Update user with new password and mark as active
      await storage.updateUser(user.id, {
        password: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
        isInvitationActive: false,
      });

      // Update invitation status
      await storage.updateInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedUserId: user.id,
      });

      // Create staff record
      await storage.createHospitalStaff({
        staffId: user.username,
        name: name,
        role: this.mapRoleToStaffRole(invitation.role),
        licenseNumber: `INV-${user.id}`, // Temporary license number
        department: invitation.department,
        hospitalId: invitation.hospitalId.toString(),
        isActive: true,
        isOnDuty: false,
      });

      // Log the acceptance
      await auditService.logEvent({
        eventType: "STAFF_INVITATION_ACCEPTED",
        actorType: "STAFF",
        actorId: user.id.toString(),
        targetType: "STAFF_INVITATION",
        targetId: invitation.id.toString(),
        action: "ACCEPT",
        outcome: "SUCCESS",
        metadata: {
          email: invitation.email,
          role: invitation.role,
          department: invitation.department,
        },
        severity: "info",
      });

      return {
        success: true,
        userId: user.id,
      };

    } catch (error: any) {
      console.error('[StaffInvitationService] Accept invitation failed:', error);
      return {
        success: false,
        error: "Failed to accept invitation"
      };
    }
  }

  /**
   * Get hospital staff count
   */
  private async getHospitalStaffCount(hospitalId: number): Promise<number> {
    const staff = await storage.getHospitalStaffByHospitalId(hospitalId.toString());
    return staff.length;
  }

  /**
   * Generate invitation token
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate temporary username
   */
  private generateTemporaryUsername(email: string): string {
    const emailPrefix = email.split('@')[0];
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${emailPrefix}_${randomSuffix}`;
  }

  /**
   * Generate temporary password
   */
  private generateTemporaryPassword(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Get hospital name
   */
  private async getHospitalName(hospitalId: number): Promise<string> {
    const hospital = await storage.getUser(hospitalId);
    return hospital?.hospitalName || 'Unknown Hospital';
  }

  /**
   * Map role to hospital type
   */
  private getHospitalTypeFromRole(role: string): string {
    switch (role) {
      case 'HOSPITAL_A_ONLY':
        return 'A';
      case 'HOSPITAL_B_ONLY':
        return 'B';
      case 'BOTH_A_B':
      case 'EMERGENCY_AUTHORIZER':
        return 'A'; // Default to A for dual access
      default:
        return 'A';
    }
  }

  /**
   * Map invitation role to staff role
   */
  private mapRoleToStaffRole(invitationRole: string): string {
    switch (invitationRole) {
      case 'EMERGENCY_AUTHORIZER':
        return 'EMERGENCY_DOCTOR';
      case 'HOSPITAL_A_ONLY':
      case 'HOSPITAL_B_ONLY':
      case 'BOTH_A_B':
        return 'PHYSICIAN';
      default:
        return 'PHYSICIAN';
    }
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    email: string,
    invitationData: {
      hospitalName: string;
      role: string;
      department: string;
      username: string;
      temporaryPassword: string;
      invitationToken: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    const activationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${invitationData.invitationToken}`;
    
    const msg = {
      to: email,
      from: 'brandmwenja@gmail.com',
      subject: `Welcome to ${invitationData.hospitalName} - Your MediBridge Account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to MediBridge!</h2>
          <p>You have been invited to join <strong>${invitationData.hospitalName}</strong> on the MediBridge Healthcare System.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">Your Account Details:</h3>
            <p><strong>Role:</strong> ${invitationData.role.replace(/_/g, ' ')}</p>
            <p><strong>Department:</strong> ${invitationData.department}</p>
            <p><strong>Username:</strong> <code style="background-color: #e5e7eb; padding: 4px; border-radius: 4px;">${invitationData.username}</code></p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 4px; border-radius: 4px;">${invitationData.temporaryPassword}</code></p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This invitation expires on ${invitationData.expiresAt.toLocaleString()}. Please activate your account within 24 hours.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Activate Your Account
            </a>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Click the "Activate Your Account" button above</li>
            <li>Enter your temporary credentials</li>
            <li>Set a new secure password</li>
            <li>Complete your profile</li>
          </ol>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated invitation from ${invitationData.hospitalName}. If you have any questions, please contact your hospital administrator.
          </p>
        </div>
      `,
      text: `
        Welcome to MediBridge!
        
        You have been invited to join ${invitationData.hospitalName} on the MediBridge Healthcare System.
        
        Your Account Details:
        - Role: ${invitationData.role.replace(/_/g, ' ')}
        - Department: ${invitationData.department}
        - Username: ${invitationData.username}
        - Temporary Password: ${invitationData.temporaryPassword}
        
        Important: This invitation expires on ${invitationData.expiresAt.toLocaleString()}.
        
        To activate your account, visit: ${activationUrl}
        
        Next Steps:
        1. Click the activation link above
        2. Enter your temporary credentials
        3. Set a new secure password
        4. Complete your profile
        
        This is an automated invitation from ${invitationData.hospitalName}.
      `
    };

    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here') {
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.default.send(msg);
    } else {
      console.log(`[DEV MODE] Staff invitation email would be sent to ${email}`);
      console.log(`[DEV MODE] Activation URL: ${activationUrl}`);
      console.log(`[DEV MODE] Username: ${invitationData.username}, Password: ${invitationData.temporaryPassword}`);
    }
  }
}

export const staffInvitationService = StaffInvitationService.getInstance(); 