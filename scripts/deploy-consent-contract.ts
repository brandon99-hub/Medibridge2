import { 
  Client, 
  ContractCreateFlow,
  PrivateKey,
  FileCreateTransaction,
  ContractCreateTransaction,
  ContractFunctionParameters
} from "@hashgraph/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployConsentContract() {
  console.log("🚀 Deploying MediBridge Consent Smart Contract...\n");

  // Initialize Hedera client
  if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
    throw new Error("❌ HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env");
  }

  const client = Client.forTestnet();
  client.setOperator(
    process.env.HEDERA_OPERATOR_ID,
    process.env.HEDERA_OPERATOR_KEY
  );

  console.log("✅ Connected to Hedera Testnet");
  console.log(`📍 Operator Account: ${process.env.HEDERA_OPERATOR_ID}\n`);

  try {
    // Read the compiled contract bytecode
    // Note: You'll need to compile the Solidity contract first
    console.log("📄 Reading contract file...");
    const contractPath = join(__dirname, "..", "contracts", "MediBridgeConsent.sol");
    const contractSource = readFileSync(contractPath, "utf8");
    
    console.log("⚠️  NOTE: This script requires the contract to be compiled to bytecode.");
    console.log("⚠️  For now, please use Option 1 (Hedera Portal) or Option 3 (HashIO).\n");
    console.log("📝 Contract source loaded from:", contractPath);
    console.log("📝 Contract size:", contractSource.length, "characters\n");
    
    console.log("🔗 To deploy manually:");
    console.log("1. Go to https://portal.hedera.com/");
    console.log("2. Navigate to Smart Contracts → Deploy Contract");
    console.log("3. Upload: contracts/MediBridgeConsent.sol");
    console.log("4. Compile with Solidity 0.8.20+");
    console.log("5. Deploy and copy the Contract ID");
    console.log("6. Add to .env: HEDERA_CONSENT_CONTRACT_ID=0.0.XXXXXX\n");

    // If you have the bytecode, uncomment this:
    /*
    console.log("📤 Uploading contract bytecode...");
    const bytecode = "YOUR_COMPILED_BYTECODE_HERE";
    
    const contractCreate = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(100000)
      .setConstructorParameters(new ContractFunctionParameters());

    const contractCreateSubmit = await contractCreate.execute(client);
    const contractCreateReceipt = await contractCreateSubmit.getReceipt(client);
    const contractId = contractCreateReceipt.contractId;

    console.log("✅ Contract deployed successfully!");
    console.log(`📋 Contract ID: ${contractId?.toString()}\n`);
    console.log("📝 Add this to your .env file:");
    console.log(`HEDERA_CONSENT_CONTRACT_ID=${contractId?.toString()}\n`);
    */

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }

  client.close();
}

deployConsentContract();
