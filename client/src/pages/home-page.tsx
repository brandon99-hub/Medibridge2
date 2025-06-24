import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import NavigationHeader from "@/components/navigation-header";
import HospitalAInterface from "@/components/hospital-a-interface";
import HospitalBInterface from "@/components/hospital-b-interface";
import ConsentModal from "@/components/consent-modal";

export default function HomePage() {
  const { user } = useAuth();
  const [currentHospital, setCurrentHospital] = useState<"A" | "B">(user?.hospitalType as "A" | "B" || "A");
  const [consentModalData, setConsentModalData] = useState<{
    patientName: string;
    nationalId: string;
    recordCount: number;
    records: any[];
  } | null>(null);

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
    </div>
  );
}
