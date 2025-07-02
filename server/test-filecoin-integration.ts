import { filecoinService } from "./filecoin-service";
import { enhancedStorageService } from "./enhanced-storage-service";

async function testFilecoinIntegration() {
  console.log("🧪 Testing Filecoin Integration...\n");

  try {
    // Test 1: Basic Filecoin storage
    console.log("1. Testing basic Filecoin storage...");
    const testContent = Buffer.from("Test medical record data for Filecoin integration");
    const testMetadata = {
      filename: "test_record.json",
      patientDID: "did:key:test123",
      recordType: "test_record"
    };

    const filecoinResult = await filecoinService.storeOnFilecoin(testContent, testMetadata);
    console.log("✅ Filecoin storage successful:", filecoinResult);

    // Test 2: Filecoin retrieval
    console.log("\n2. Testing Filecoin retrieval...");
    const retrievedContent = await filecoinService.retrieveFromFilecoin(filecoinResult.cid);
    console.log("✅ Filecoin retrieval successful:", retrievedContent.toString());

    // Test 3: Enhanced storage with triple redundancy
    console.log("\n3. Testing enhanced storage with triple redundancy...");
    const medicalRecord = {
      patientName: "John Doe",
      nationalId: "123456789",
      visitDate: "2024-01-15",
      diagnosis: "Common cold",
      prescription: "Rest and fluids"
    };

    const storageResult = await enhancedStorageService.storeWithTripleRedundancy(
      medicalRecord,
      { recordType: "medical_record" },
      "did:key:test123"
    );
    console.log("✅ Enhanced storage successful:", {
      ipfsCid: storageResult.ipfsCid,
      filecoinCid: storageResult.filecoinCid,
      redundancyLevel: storageResult.redundancyLevel
    });

    // Test 4: Storage strategy optimization
    console.log("\n4. Testing storage strategy optimization...");
    const strategy = await enhancedStorageService.optimizeStorageStrategy(
      1024 * 1024, // 1MB
      "frequent"
    );
    console.log("✅ Storage strategy:", strategy);

    // Test 5: Storage health check
    console.log("\n5. Testing storage health check...");
    const health = await enhancedStorageService.getStorageHealth();
    console.log("✅ Storage health:", health);

    console.log("\n🎉 All Filecoin integration tests passed!");

  } catch (error) {
    console.error("❌ Filecoin integration test failed:", error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFilecoinIntegration();
}

export { testFilecoinIntegration }; 