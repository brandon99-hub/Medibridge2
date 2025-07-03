import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import NavigationHeader from "@/components/navigation-header";
import HospitalAInterface from "@/components/hospital-a-interface";
import HospitalBInterface from "@/components/hospital-b-interface";
import ConsentModal from "@/components/consent-modal";
import Web3ConsentDemo from "@/components/web3-consent-demo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Building } from "lucide-react";
import HospitalStaffProfileCompletion from "@/components/hospital-staff-profile-completion";
import { useQuery } from "@tanstack/react-query";

export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  const [currentHospital, setCurrentHospital] = useState<"A" | "B">(user?.hospitalType as "A" | "B" || "A");
  const [consentModalData, setConsentModalData] = useState<{
    patientName: string;
    patientDID: string;
    nationalId: string;
    recordCount: number;
    records: any[];
  } | null>(null);

  // Staff profile modal state
  const [showStaffProfileModal, setShowStaffProfileModal] = useState(false);
  const [existingStaff, setExistingStaff] = useState<any[]>([]);
  const [hasSkippedProfile, setHasSkippedProfile] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false); // Track if modal opened from dropdown

  // Fetch staff profile status for admin users
  const { data: staffProfileData } = useQuery({
    queryKey: ['staffProfile', user.id],
    queryFn: async () => {
      if (!user.isAdmin || !user.id) return null;
      const response = await fetch(`/api/hospital/staff-profile?hospitalId=${user.id}`);
      return response.json();
    },
    enabled: user.isAdmin && !!user.id,
    retry: 1,
    retryDelay: 1000,
  });

  // Auto-popup staff profile form for admin users without staff profiles
  useEffect(() => {
    if (
      user.isAdmin &&
      !showStaffProfileModal &&
      !hasSkippedProfile &&
      (staffProfileData === null || staffProfileData === undefined || !staffProfileData.hasStaffProfile || staffProfileData.staffCount < 2)
    ) {
      setIsManualOpen(false); // Auto-popup, not manual
      setShowStaffProfileModal(true);
    }
    // Always pre-fill with latest staff data
    if (staffProfileData?.staff) {
      setExistingStaff(staffProfileData.staff);
    }
  }, [user.isAdmin, staffProfileData, showStaffProfileModal, hasSkippedProfile]);

  // Handler for opening modal from dropdown (manual open)
  const handleOpenStaffProfileModal = () => {
    setIsManualOpen(true);
    setShowStaffProfileModal(true);
    // Always pre-fill with latest staff data
    if (staffProfileData?.staff) {
      setExistingStaff(staffProfileData.staff);
    }
  };

  const showConsentModal = (data: any) => {
    setConsentModalData(data);
  };

  const hideConsentModal = () => {
    setConsentModalData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavigationHeader 
        currentHospital={currentHospital}
        onHospitalSwitch={setCurrentHospital}
        user={user!}
        showStaffProfileModal={showStaffProfileModal}
        setShowStaffProfileModal={setShowStaffProfileModal}
        setExistingStaff={setExistingStaff}
        onOpenStaffProfileModal={handleOpenStaffProfileModal}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentHospital === "A" ? (
          <HospitalAInterface />
        ) : (
          <HospitalBInterface onShowConsentModal={showConsentModal} />
        )}
      </main>

      {consentModalData && (
        <ConsentModal
          data={consentModalData}
          onClose={hideConsentModal}
          onConsent={(consentGrantedBy) => {
            // Handle consent logic
            console.log("Consent granted by:", consentGrantedBy);
            hideConsentModal();
          }}
        />
      )}
      {/* Staff Profile Modal - always rendered for admin, can be opened from dropdown or auto-popup */}
      {user.isAdmin && (
        <HospitalStaffProfileCompletion
          isOpen={showStaffProfileModal}
          onClose={() => {
            setShowStaffProfileModal(false);
            if (!isManualOpen) setHasSkippedProfile(true); // Only set skip if not manual
          }}
          onComplete={(staff) => {
            setExistingStaff(staff);
            setShowStaffProfileModal(false);
            setHasSkippedProfile(false);
          }}
          hospitalId={user.id?.toString() || ""}
          isEdit={existingStaff.length > 0}
          existingStaff={existingStaff}
          existingAdminLicense={staffProfileData?.adminLicense || ""}
        />
      )}
    </div>
  );
}
