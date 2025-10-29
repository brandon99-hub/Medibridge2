/**
 * Simple Smart Contract Deployment using Hedera SDK
 * This compiles and deploys in one step - no need for Remix!
 * Run with: npx tsx deploy-consent-simple.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  ContractCreateFlow,
  Hbar,
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function deployConsentContract() {
  console.log("\n🚀 Deploying MediBridge Consent Contract to Hedera...\n");

  try {
    // 1. Setup Hedera Client
    console.log("1️⃣ Setting up Hedera client...");
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    console.log(`   ✅ Connected as ${operatorId.toString()}\n`);

    // 2. Read contract source code
    console.log("2️⃣ Reading contract source code...");
    const contractPath = path.join(__dirname, "contracts", "MediBridgeConsent.sol");
    const contractSource = fs.readFileSync(contractPath, "utf8");
    console.log(`   ✅ Contract loaded (${contractSource.length} characters)\n`);

    // 3. Deploy using ContractCreateFlow (handles compilation + deployment)
    console.log("3️⃣ Compiling and deploying contract...");
    console.log("   ⏳ This may take 30-60 seconds...\n");

    const contractCreateFlow = new ContractCreateFlow()
      .setGas(150000) // Increased gas for safety
      .setBytecode(contractSource); // SDK will compile this

    const txResponse = await contractCreateFlow.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const contractId = receipt.contractId;

    console.log(`   ✅ Contract deployed: ${contractId?.toString()}\n`);

    // 4. Update .env file
    console.log("4️⃣ Updating .env file...");
    const envPath = path.join(__dirname, ".env");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Replace or add HEDERA_CONSENT_CONTRACT_ID
    if (envContent.includes("HEDERA_CONSENT_CONTRACT_ID=")) {
      envContent = envContent.replace(
        /HEDERA_CONSENT_CONTRACT_ID=.*/,
        `HEDERA_CONSENT_CONTRACT_ID=${contractId?.toString()}`
      );
    } else {
      envContent += `\nHEDERA_CONSENT_CONTRACT_ID=${contractId?.toString()}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("   ✅ .env file updated\n");

    // 5. Summary
    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 CONTRACT DEPLOYMENT SUCCESSFUL!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n📋 Contract Details:`);
    console.log(`   Contract ID: ${contractId?.toString()}`);
    console.log(`   Network: Hedera Testnet`);
    console.log(`   Gas Used: 150,000`);
    console.log(`\n🔗 View on HashScan:`);
    console.log(`   https://hashscan.io/testnet/contract/${contractId?.toString()}`);
    console.log(`\n✅ Your .env has been updated with the contract ID.`);
    console.log(`   Restart your server to use the deployed contract.`);
    console.log(`\n📝 Test the contract:`);
    console.log(`   1. Restart server: npm run dev`);
    console.log(`   2. Patient grants consent from portal`);
    console.log(`   3. Hospital verifies consent`);
    console.log(`\n`);

    client.close();
    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ Deployment Failed!");
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes("INSUFFICIENT_PAYER_BALANCE")) {
      console.error("\n💰 Insufficient Balance:");
      console.error("   Your account doesn't have enough HBAR for deployment.");
      console.error("   Required: ~20-30 HBAR");
      console.error("   Check balance: npx tsx test-hedera.ts");
    } else if (error.message.includes("INVALID_SIGNATURE")) {
      console.error("\n🔑 Invalid Credentials:");
      console.error("   Check HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env");
    } else {
      console.error("\nTroubleshooting:");
      console.error("  1. Check Hedera network status: https://status.hedera.com");
      console.error("  2. Verify contract syntax is valid Solidity 0.8.20");
      console.error("  3. Try increasing gas limit in the script");
    }
    
    process.exit(1);
  }
}

deployConsentContract();
