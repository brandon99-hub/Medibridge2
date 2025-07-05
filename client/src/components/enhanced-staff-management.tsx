import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  User, 
  Shield, 
  CheckCircle, 
  Mail, 
  Phone, 
  Briefcase, 
  UserCheck, 
  Loader2, 
  Plus, 
  Trash2, 
  Stethoscope,
  GraduationCap,
  Building2,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  UserPlus,
  Mail as MailIcon,
  Calendar,
  X,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";

// Debug: Check if CardDescription is available
console.log('CardDescription available:', typeof CardDescription);

const STAFF_ROLES = [
  { value: "HOSPITAL_A_ONLY", label: "Hospital A Only (Record Creation)", icon: Stethoscope, color: "bg-blue-100 text-blue-700" },
  { value: "HOSPITAL_B_ONLY", label: "Hospital B Only (Record Access)", icon: Eye, color: "bg-green-100 text-green-700" },
  { value: "BOTH_A_B", label: "Both Hospitals (Full Access)", icon: Users, color: "bg-purple-100 text-purple-700" },
  { value: "EMERGENCY_AUTHORIZER", label: "Emergency Authorizer", icon: AlertTriangle, color: "bg-red-100 text-red-700" }
];

const DEPARTMENTS = [
  "Emergency Medicine",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Surgery",
  "Internal Medicine",
  "Radiology",
  "Laboratory",
  "Pharmacy",
  "Administration"
];

export interface EnhancedStaffManagementProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalId: string;
}

interface StaffMember {
  id: number;
  staffId: string;
  name: string;
  role: string;
  department: string;
  isActive: boolean;
  isOnDuty: boolean;
  createdAt: string;
}

interface PendingInvitation {
  id: number;
  email: string;
  role: string;
  department: string;
  expiresAt: string;
  createdAt: string;
}

interface StaffStats {
  totalStaff: number;
  activeStaff: number;
  onDutyStaff: number;
  pendingInvitations: number;
}

export default function EnhancedStaffManagement({
  isOpen,
  onClose,
  hospitalId
}: EnhancedStaffManagementProps) {
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "",
    department: "",
    name: ""
  });

  // Fetch staff data
  const { data: staffData, isLoading, refetch } = useQuery({
    queryKey: ['staff-management', hospitalId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/staff/list");
      return response.json();
    },
    enabled: isOpen
  });

  const staff: StaffMember[] = staffData?.staff || [];
  const pendingInvitations: PendingInvitation[] = staffData?.pendingInvitations || [];
  const stats: StaffStats = staffData?.stats || { totalStaff: 0, activeStaff: 0, onDutyStaff: 0, pendingInvitations: 0 };

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (invitationData: typeof inviteForm) => {
      const response = await apiRequestWithCsrf("POST", "/api/staff/invite", invitationData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: "Staff invitation has been sent successfully.",
      });
      setShowInviteForm(false);
      setInviteForm({ email: "", role: "", department: "", name: "" });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Invitation Failed",
        description: error.message || "Failed to send invitation.",
        variant: "destructive",
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequestWithCsrf("DELETE", `/api/staff/invitation/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Cancelled",
        description: "Staff invitation has been cancelled.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel invitation.",
        variant: "destructive",
      });
    },
  });

  // Deactivate/Reactivate staff mutation
  const toggleStaffStatusMutation = useMutation({
    mutationFn: async ({ staffId, action }: { staffId: string; action: 'deactivate' | 'reactivate' }) => {
      const response = await apiRequestWithCsrf("POST", `/api/staff/${staffId}/${action}`);
      return response.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: `Staff ${action === 'deactivate' ? 'Deactivated' : 'Reactivated'}`,
        description: `Staff member has been ${action === 'deactivate' ? 'deactivated' : 'reactivated'} successfully.`,
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to update staff status.",
        variant: "destructive",
      });
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.role || !inviteForm.department || !inviteForm.name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createInvitationMutation.mutate(inviteForm);
  };

  const getRoleInfo = (role: string) => {
    return STAFF_ROLES.find(r => r.value === role) || STAFF_ROLES[0];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl p-0 overflow-hidden shadow-2xl rounded-3xl border-0 bg-gradient-to-br from-slate-50 to-blue-50 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-bold">
                    Staff Management
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 text-lg mt-2">
                    Manage your hospital staff and invitations
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="text-white hover:bg-white/20"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[calc(90vh-200px)] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="staff">Active Staff</TabsTrigger>
              <TabsTrigger value="invitations">Invitations</TabsTrigger>
              <TabsTrigger value="invite">Invite Staff</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Total Staff</p>
                        <p className="text-2xl font-bold text-blue-800">{stats.totalStaff}/5</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-500 rounded-lg">
                        <UserCheck className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600 font-medium">Active Staff</p>
                        <p className="text-2xl font-bold text-green-800">{stats.activeStaff}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Clock className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-purple-600 font-medium">On Duty</p>
                        <p className="text-2xl font-bold text-purple-800">{stats.onDutyStaff}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-500 rounded-lg">
                        <MailIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-orange-600 font-medium">Pending Invites</p>
                        <p className="text-2xl font-bold text-orange-800">{stats.pendingInvitations}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <Button
                      onClick={() => setActiveTab("invite")}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite New Staff
                    </Button>
                    <Button
                      onClick={() => setActiveTab("staff")}
                      variant="outline"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View All Staff
                    </Button>
                    <Button
                      onClick={() => setActiveTab("invitations")}
                      variant="outline"
                    >
                      <MailIcon className="h-4 w-4 mr-2" />
                      Manage Invitations
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {staff.length === 0 && pendingInvitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No staff or invitations yet</p>
                      <Button
                        onClick={() => setActiveTab("invite")}
                        className="mt-4"
                        variant="outline"
                      >
                        Invite Your First Staff Member
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {staff.slice(0, 3).map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-gray-600">{member.role.replace(/_/g, ' ')} • {member.department}</p>
                            </div>
                          </div>
                          <Badge variant={member.isActive ? "default" : "secondary"}>
                            {member.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                      {pendingInvitations.slice(0, 2).map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                              <MailIcon className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-gray-600">
                                {invitation.role.replace(/_/g, ' ')} • Expires in {getTimeUntilExpiry(invitation.expiresAt)}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            Pending
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Staff Tab */}
            <TabsContent value="staff" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Active Staff Members</span>
                    <Badge variant="outline">{staff.length}/5</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {staff.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No staff members yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staff.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{member.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleInfo(member.role).color}>
                                {getRoleInfo(member.role).label}
                              </Badge>
                            </TableCell>
                            <TableCell>{member.department}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Badge variant={member.isActive ? "default" : "secondary"}>
                                  {member.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {member.isOnDuty && (
                                  <Badge variant="outline" className="text-green-600 border-green-300">
                                    On Duty
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(member.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleStaffStatusMutation.mutate({
                                    staffId: member.staffId,
                                    action: member.isActive ? 'deactivate' : 'reactivate'
                                  })}
                                  disabled={toggleStaffStatusMutation.isPending}
                                >
                                  {member.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invitations Tab */}
            <TabsContent value="invitations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Pending Invitations</span>
                    <Badge variant="outline">{pendingInvitations.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingInvitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MailIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No pending invitations</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingInvitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <MailIcon className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{invitation.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRoleInfo(invitation.role).color}>
                                {getRoleInfo(invitation.role).label}
                              </Badge>
                            </TableCell>
                            <TableCell>{invitation.department}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span className={getTimeUntilExpiry(invitation.expiresAt) === "Expired" ? "text-red-600" : ""}>
                                  {getTimeUntilExpiry(invitation.expiresAt)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                                disabled={cancelInvitationMutation.isPending}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invite Tab */}
            <TabsContent value="invite" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <UserPlus className="h-5 w-5" />
                    <span>Invite New Staff Member</span>
                  </CardTitle>
                  <CardDescription>
                    Send an email invitation to a new staff member. They will receive temporary credentials and an activation link.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInviteSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="staff@hospital.com"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          type="text"
                          value={inviteForm.name}
                          onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                          placeholder="Dr. John Smith"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Role *</Label>
                        <select
                          id="role"
                          value={inviteForm.role}
                          onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Select a role</option>
                          {STAFF_ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="department">Department *</Label>
                        <select
                          id="department"
                          value={inviteForm.department}
                          onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Select a department</option>
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        The staff member will receive an email with temporary credentials and must activate their account within 24 hours.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInviteForm({ email: "", role: "", department: "", name: "" })}
                      >
                        Clear Form
                      </Button>
                      <Button
                        type="submit"
                        disabled={createInvitationMutation.isPending}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      >
                        {createInvitationMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending Invitation...
                          </>
                        ) : (
                          <>
                            <MailIcon className="h-4 w-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
} 