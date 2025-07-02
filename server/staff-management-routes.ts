import express from 'express';
import { staffInvitationService } from './staff-invitation-service';
import { storage } from './storage';
import { auditService } from './audit-service';
import { z } from 'zod';

const router = express.Router();

import { requireAdminAuth } from './admin-auth-middleware';

// Validation schemas
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['HOSPITAL_A_ONLY', 'HOSPITAL_B_ONLY', 'BOTH_A_B', 'EMERGENCY_AUTHORIZER']),
  department: z.string().min(1),
  name: z.string().min(1),
});

const acceptInvitationSchema = z.object({
  invitationToken: z.string(),
  newPassword: z.string().min(8),
  name: z.string().min(1),
});

/**
 * Create staff invitation (Admin only)
 * POST /api/staff/invite
 */
router.post('/invite', requireAdminAuth, async (req, res) => {
  try {
    // Validate admin access - now handled by middleware
    if (!req.user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validation = createInvitationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error });
    }

    const { email, role, department, name } = validation.data;
    const hospitalId = req.user!.id;

    // Check if hospital has reached staff limit
    const currentStaffCount = await storage.getHospitalStaffByHospitalId(hospitalId.toString());
    if (currentStaffCount.length >= 5) {
      return res.status(400).json({ 
        error: 'Hospital has reached maximum staff limit (4 staff + 1 admin)' 
      });
    }

    // Create invitation
    const result = await staffInvitationService.createStaffInvitation(
      hospitalId,
      hospitalId, // invitedBy
      { email, role, department, name }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Staff invitation sent successfully',
      invitationId: result.invitationId,
    });

  } catch (error: any) {
    console.error('[Staff Management] Create invitation error:', error);
    res.status(500).json({ error: 'Failed to create staff invitation' });
  }
});

/**
 * Accept staff invitation
 * POST /api/staff/accept-invitation
 */
router.post('/accept-invitation', async (req, res) => {
  try {
    const validation = acceptInvitationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error });
    }

    const { invitationToken, newPassword, name } = validation.data;

    const result = await staffInvitationService.acceptInvitation(
      invitationToken,
      newPassword,
      name
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Account activated successfully',
      userId: result.userId,
    });

  } catch (error: any) {
    console.error('[Staff Management] Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * Get hospital staff list (Admin only)
 * GET /api/staff/list
 */
router.get('/list', requireAdminAuth, async (req, res) => {
  try {
    // Validate admin access - now handled by middleware
    if (!req.user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const hospitalId = req.user.id.toString();
    
    // Get active staff
    const staff = await storage.getHospitalStaffByHospitalId(hospitalId);
    
    // Get pending invitations
    const invitations = await storage.getInvitationsByHospitalId(req.user.id);
    const pendingInvitations = invitations.filter(inv => inv.status === 'pending' && inv.expiresAt > new Date());

    res.json({
      success: true,
      staff: staff.map(s => ({
        id: s.id,
        staffId: s.staffId,
        name: s.name,
        role: s.role,
        department: s.department,
        isActive: s.isActive,
        isOnDuty: s.isOnDuty,
        createdAt: s.createdAt,
      })),
      pendingInvitations: pendingInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        department: inv.department,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
      stats: {
        totalStaff: staff.length,
        activeStaff: staff.filter(s => s.isActive).length,
        onDutyStaff: staff.filter(s => s.isOnDuty).length,
        pendingInvitations: pendingInvitations.length,
      }
    });

  } catch (error: any) {
    console.error('[Staff Management] Get staff list error:', error);
    res.status(500).json({ error: 'Failed to get staff list' });
  }
});

/**
 * Cancel pending invitation (Admin only)
 * DELETE /api/staff/invitation/:invitationId
 */
router.delete('/invitation/:invitationId', requireAdminAuth, async (req, res) => {
  try {
    // Validate admin access - now handled by middleware
    if (!req.user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const invitationId = parseInt(req.params.invitationId);
    if (isNaN(invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation ID' });
    }

    // Get invitation and verify it belongs to this hospital
    const invitations = await storage.getInvitationsByHospitalId(req.user.id);
    const invitation = invitations.find(inv => inv.id === invitationId);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending invitations' });
    }

    // Cancel invitation
    await storage.updateInvitation(invitationId, {
      status: 'cancelled'
    });

    // Log the cancellation
    await auditService.logEvent({
      eventType: "STAFF_INVITATION_CANCELLED",
      actorType: "HOSPITAL_ADMIN",
      actorId: req.user!.id.toString(),
      targetType: "STAFF_INVITATION",
      targetId: invitationId.toString(),
      action: "CANCEL",
      outcome: "SUCCESS",
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
      severity: "info",
    });

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error: any) {
    console.error('[Staff Management] Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

/**
 * Deactivate staff member (Admin only)
 * POST /api/staff/:staffId/deactivate
 */
router.post('/:staffId/deactivate', requireAdminAuth, async (req, res) => {
  try {
    // Validate admin access - now handled by middleware
    if (!req.user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const staffId = req.params.staffId;
    const hospitalId = req.user.id.toString();

    // Get staff member and verify they belong to this hospital
    const staff = await storage.getHospitalStaffByHospitalId(hospitalId);
    const staffMember = staff.find(s => s.staffId === staffId);
    
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (!staffMember.isActive) {
      return res.status(400).json({ error: 'Staff member is already inactive' });
    }

    // Deactivate staff member
    await storage.updateHospitalStaff(staffMember.id, {
      isActive: false,
      isOnDuty: false,
    });

    // Log the deactivation
    await auditService.logEvent({
      eventType: "STAFF_DEACTIVATED",
      actorType: "HOSPITAL_ADMIN",
      actorId: req.user!.id.toString(),
      targetType: "HOSPITAL_STAFF",
      targetId: staffMember.id.toString(),
      action: "DEACTIVATE",
      outcome: "SUCCESS",
      metadata: {
        staffId: staffMember.staffId,
        name: staffMember.name,
        role: staffMember.role,
      },
      severity: "info",
    });

    res.json({
      success: true,
      message: 'Staff member deactivated successfully'
    });

  } catch (error: any) {
    console.error('[Staff Management] Deactivate staff error:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

/**
 * Reactivate staff member (Admin only)
 * POST /api/staff/:staffId/reactivate
 */
router.post('/:staffId/reactivate', requireAdminAuth, async (req, res) => {
  try {
    // Validate admin access - now handled by middleware
    if (!req.user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const staffId = req.params.staffId;
    const hospitalId = req.user.id.toString();

    // Get staff member and verify they belong to this hospital
    const staff = await storage.getHospitalStaffByHospitalId(hospitalId);
    const staffMember = staff.find(s => s.staffId === staffId);
    
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staffMember.isActive) {
      return res.status(400).json({ error: 'Staff member is already active' });
    }

    // Reactivate staff member
    await storage.updateHospitalStaff(staffMember.id, {
      isActive: true,
    });

    // Log the reactivation
    await auditService.logEvent({
      eventType: "STAFF_REACTIVATED",
      actorType: "HOSPITAL_ADMIN",
      actorId: req.user!.id.toString(),
      targetType: "HOSPITAL_STAFF",
      targetId: staffMember.id.toString(),
      action: "REACTIVATE",
      outcome: "SUCCESS",
      metadata: {
        staffId: staffMember.staffId,
        name: staffMember.name,
        role: staffMember.role,
      },
      severity: "info",
    });

    res.json({
      success: true,
      message: 'Staff member reactivated successfully'
    });

  } catch (error: any) {
    console.error('[Staff Management] Reactivate staff error:', error);
    res.status(500).json({ error: 'Failed to reactivate staff member' });
  }
});

/**
 * Get invitation details by token (for frontend activation page)
 * GET /api/staff/invitation/:token
 */
router.get('/invitation/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    const invitation = await storage.getInvitationByToken(token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation has already been used or expired' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Get hospital details
    const hospital = await storage.getUser(invitation.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        department: invitation.department,
        hospitalName: hospital.hospitalName,
        expiresAt: invitation.expiresAt,
      }
    });

  } catch (error: any) {
    console.error('[Staff Management] Get invitation error:', error);
    res.status(500).json({ error: 'Failed to get invitation details' });
  }
});

export default router; 