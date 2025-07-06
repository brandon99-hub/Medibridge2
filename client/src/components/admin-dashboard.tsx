import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrf } from "@/hooks/use-csrf";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  FileText,
  TrendingUp,
  Eye,
  Lock,
  User,
  Database,
  Key,
  Globe,
  UserPlus,
  Gauge,
  Zap,
  Target,
  BarChart3,
  Home
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import EnhancedStaffManagement from "@/components/enhanced-staff-management";

// ZKP Analytics Component
function ZKPAnalytics() {
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ['/api/zkp/analytics'],
    queryFn: async () => apiRequest("GET", "/api/zkp/analytics").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const analyticsData = analytics?.analytics || {
    totalProofs: 0,
    activeProofs: 0,
    expiringProofs: 0,
    proofTypes: {
      hiv: 0,
      vaccination: 0,
      insurance: 0
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ZK Proofs</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.totalProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">All time proofs issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Proofs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.activeProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">Currently valid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : analyticsData.expiringProofs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600">Next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">USSD Sessions</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : "N/A"}
            </div>
            <p className="text-xs text-slate-600">Today's sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Proof Types Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Proof Types Distribution</CardTitle>
          <CardDescription>Breakdown of ZK proofs by type (no PII shown)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.hiv}
              </div>
              <div className="text-sm text-slate-600">HIV-Negative Proofs</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.vaccination}
              </div>
              <div className="text-sm text-slate-600">Vaccination Proofs</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {isLoading ? <Skeleton className="h-8 w-1/2 mx-auto" /> : analyticsData.proofTypes.insurance}
              </div>
              <div className="text-sm text-slate-600">Insurance Proofs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      // (REMOVED ZK-MedPass Quick Actions card)
    </div>
  );
}

const SIDEBAR_TABS = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "violations", label: "Security Violations", icon: AlertTriangle },
  { key: "credentials", label: "VC Monitoring", icon: Shield },
  { key: "access", label: "Access Patterns", icon: Eye },
  { key: "activity", label: "Recent Activity", icon: Activity },
  { key: "staff", label: "Staff Management", icon: UserPlus },
  { key: "zkp", label: "ZKP System", icon: BarChart3 },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [violationsFilter, setViolationsFilter] = useState<"unresolved" | "resolved">("unresolved");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { apiRequestWithCsrf } = useCsrf();

  // Fetch security audit summary
  const { data: auditSummary, isLoading: isLoadingAuditSummary } = useQuery<any>({
    queryKey: ['/api/security/audit-summary'],
    queryFn: async () => apiRequest("GET", "/api/security/audit-summary").then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch security violations based on filter
  const { data: securityViolationsData, isLoading: isLoadingViolations } = useQuery<any>({
    queryKey: ['/api/admin/security-violations', { resolved: violationsFilter === "resolved", limit: 10 }],
    queryFn: async () => apiRequest("GET", `/api/admin/security-violations?resolved=${violationsFilter === "resolved"}&limit=10`).then(res => res.json()),
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  const recentViolations = securityViolationsData?.violations || [];

  // Use auditSummary for securityMetrics if available
  const securityMetrics = auditSummary?.summary?.securityMetrics || {
    successfulLogins: 0,
    failedLogins: 0,
    unauthorizedAttempts: 0,
    recordAccesses: 0,
  };
  const overviewMetrics = auditSummary?.summary || {
    totalEvents: 0,
    securityViolations: 0, // This is unresolved violations count
    consentEvents: 0,
  };

  // Use real VC Issuance Stats and Consent Trends from backend
  const vcIssuanceStats = auditSummary?.summary?.vcIssuanceStats || {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    avgResponseTime: null,
  };
  const consentTrends = auditSummary?.summary?.consentTrends || {
    grantRate: null,
    avgProcessingTime: null,
    revocationRate: null,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white shadow-lg min-h-screen flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">MediBridge</h1>
              <p className="text-xs sm:text-sm text-slate-600">Admin Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2">
          {SIDEBAR_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors duration-200 text-sm sm:text-base ${
                activeTab === tab.key
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <tab.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 sm:p-4 border-t border-slate-200">
          <div className="flex items-center space-x-2 p-2 sm:p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
            <div>
              <div className="text-xs sm:text-sm font-medium text-green-900">System Healthy</div>
              <div className="text-xs text-green-700">All systems operational</div>
            </div>
          </div>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto overflow-auto">
        {/* Back Button */}
        <div className="mb-4 sm:mb-6">
          <button
            className="flex items-center px-3 sm:px-4 py-2 rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm sm:text-base"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
        {/* Section Content */}
        {activeTab === "overview" && (
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Home className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <span className="text-lg sm:text-xl">System Overview</span>
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Welcome to the MediBridge Security & Audit Dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">Quick Stats</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                        <span className="text-slate-700 text-sm sm:text-base">Successful Logins</span>
                        <span className="font-bold text-blue-600 text-sm sm:text-base">{securityMetrics.successfulLogins}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-red-50 rounded-lg">
                        <span className="text-slate-700 text-sm sm:text-base">Failed Logins</span>
                        <span className="font-bold text-red-600 text-sm sm:text-base">{securityMetrics.failedLogins}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 sm:p-3 bg-green-50 rounded-lg">
                        <span className="text-slate-700 text-sm sm:text-base">VCs Issued Today</span>
                        <span className="font-bold text-green-600 text-sm sm:text-base">{vcIssuanceStats.today}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900">System Health</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          <div>
                          <div className="font-medium text-green-900 text-sm sm:text-base">Rate Limiting</div>
                          <div className="text-xs sm:text-sm text-green-700">Active and protecting all endpoints</div>
                        </div>
          </div>
                      <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-blue-50 rounded-lg">
                        <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-blue-900 text-sm sm:text-base">Encryption</div>
                          <div className="text-xs sm:text-sm text-blue-700">AES-256-GCM protecting all data</div>
          </div>
        </div>
                      <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-purple-50 rounded-lg">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                        <div>
                          <div className="font-medium text-purple-900 text-sm sm:text-base">Audit Logging</div>
                          <div className="text-xs sm:text-sm text-purple-700">Comprehensive event tracking</div>
                        </div>
              </div>
              </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        {activeTab === "violations" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Security Violations</span>
                </CardTitle>
                <CardDescription>
                  Monitor and manage security incidents and suspicious activities
                </CardDescription>
                
                {/* Beautiful Toggle Filter */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                  <button
                    onClick={() => setViolationsFilter("unresolved")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out ${
                      violationsFilter === "unresolved"
                        ? "bg-white text-red-600 shadow-sm ring-1 ring-red-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        violationsFilter === "unresolved" ? "bg-red-500" : "bg-slate-400"
                      }`} />
                      <span>Unresolved</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setViolationsFilter("resolved")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out ${
                      violationsFilter === "resolved"
                        ? "bg-white text-green-600 shadow-sm ring-1 ring-green-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        violationsFilter === "resolved" ? "bg-green-500" : "bg-slate-400"
                      }`} />
                      <span>Resolved</span>
                    </div>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingViolations && (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoadingViolations && recentViolations.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      {violationsFilter === "unresolved" 
                        ? "No unresolved security violations found. System is looking good!"
                        : "No resolved security violations found."
                      }
                    </AlertDescription>
                  </Alert>
                )}
                {!isLoadingViolations && recentViolations.length > 0 && (
                  <div className="space-y-4">
                    {recentViolations.map((violation: any) => (
                      <div key={violation.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={violation.severity === 'high' || violation.severity === 'critical' ? 'destructive' :
                                     violation.severity === 'medium' ? 'default' : 'secondary'}
                            >
                              {violation.severity?.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{violation.violationType}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {new Date(violation.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mb-2 text-slate-700 text-sm">{
                          violation.description ||
                          (violation.details
                            ? typeof violation.details === 'object'
                              ? JSON.stringify(violation.details)
                              : violation.details
                            : "No details provided.")
                        }</div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">ID: {violation.id}</span>
                          {violationsFilter === "unresolved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-200 hover:bg-green-50"
                              onClick={async () => {
                                await apiRequestWithCsrf("POST", `/api/admin/security-violations/${violation.id}/resolve`);
                                window.location.reload();
                              }}
                            >
                              Mark as Resolved
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-700 border-orange-200 hover:bg-orange-50"
                              onClick={async () => {
                                await apiRequestWithCsrf("POST", `/api/admin/security-violations/${violation.id}/unresolve`);
                                window.location.reload();
                              }}
                            >
                              Mark as Unresolved
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === "credentials" && (
          <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span>VC Issuance Statistics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Today</span>
                    <span className="font-bold">{vcIssuanceStats.today} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">This Week</span>
                    <span className="font-bold">{vcIssuanceStats.thisWeek} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">This Month</span>
                    <span className="font-bold">{vcIssuanceStats.thisMonth} VCs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Avg Response Time</span>
                    <span className="font-bold text-green-600">{vcIssuanceStats.avgResponseTime || '--'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Consent Trends</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Consent Grant Rate</span>
                      <span className="text-lg font-bold text-green-600">{consentTrends.grantRate || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avg Processing Time</span>
                      <span className="text-lg font-bold">{consentTrends.avgProcessingTime || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Revocation Rate</span>
                      <span className="text-lg font-bold text-orange-600">{consentTrends.revocationRate || '--'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
        )}
        {activeTab === "access" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <span>Access Pattern Analysis</span>
                </CardTitle>
                <CardDescription>
                  Monitor unusual access patterns and potential security concerns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">
                      {securityMetrics.successfulLogins}
                    </div>
                    <div className="text-sm text-slate-600">Successful Logins</div>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <Lock className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-red-600">
                      {securityMetrics.failedLogins}
                    </div>
                    <div className="text-sm text-slate-600">Failed Logins</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600">
                      {securityMetrics.unauthorizedAttempts}
                    </div>
                    <div className="text-sm text-slate-600">Unauthorized Attempts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
        )}
        {activeTab === "activity" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Recent System Activity</span>
                </CardTitle>
                <CardDescription>
                  Latest audit events and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAuditSummary && (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isLoadingAuditSummary && (!auditSummary?.summary?.recentActivity || auditSummary.summary.recentActivity.length === 0) && (
                  <Alert>
                    <Activity className="h-4 w-4" />
                    <AlertDescription>
                      No recent activity found. The system may be idle or audit logging may be disabled.
                    </AlertDescription>
                  </Alert>
                )}
                {!isLoadingAuditSummary && auditSummary?.summary?.recentActivity && auditSummary.summary.recentActivity.length > 0 && (
                  <div className="space-y-4">
                    {auditSummary.summary.recentActivity.map((event: any, index: number) => (
                      <div key={event.id || index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={event.outcome === 'SUCCESS' ? 'default' : 
                                     event.outcome === 'FAILURE' ? 'destructive' : 'secondary'}
                            >
                              {event.outcome}
                            </Badge>
                            <span className="font-medium">{event.eventType}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mb-2 text-slate-700 text-sm">
                          <div className="flex items-center space-x-2 mb-1">
                            <User className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              Actor: {event.actorType} ({event.actorId})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Database className="h-3 w-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              Target: {event.targetType} ({event.targetId})
                            </span>
                          </div>
                          {event.metadata && (
                            <div className="flex items-center space-x-2">
                              <Key className="h-3 w-3 text-slate-500" />
                              <span className="text-xs text-slate-500">
                                Details: {JSON.stringify(event.metadata)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">ID: {event.id}</span>
                          <Badge variant="outline" className="text-xs">
                            {event.severity || 'info'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        )}
        {activeTab === "staff" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-green-600" />
                  <span>Staff Management</span>
                </CardTitle>
                <CardDescription>
                  Manage hospital staff accounts and invitations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Staff Management</h3>
                  <p className="text-gray-600 mb-6">
                    Use the enhanced staff management interface to invite and manage staff members.
                  </p>
                  <Button 
                    onClick={() => setShowStaffModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Open Staff Management
                  </Button>
                  <EnhancedStaffManagement
                    isOpen={showStaffModal}
                    onClose={() => setShowStaffModal(false)}
                    hospitalId={auditSummary?.summary?.hospitalId || ""}
                  />
                </div>
              </CardContent>
            </Card>
        )}
        {activeTab === "zkp" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <span>ZKP System Analytics</span>
              </CardTitle>
              <CardDescription>
                Privacy-respecting analytics for ZK proof usage and health verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ZKPAnalytics />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}