import { 
  Client, 
  TopicCreateTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  PrivateKey,
  AccountId,
  AccountBalanceQuery
} from "@hashgraph/sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

/**
 * Hedera Setup Script
 * Creates all necessary Hedera resources:
 * - HCS Topics (Audit, Consent, Security)
 * - NFT Token (Medical Records)
 */

async function setupHedera() {
  console.log("🚀 Starting Hedera Setup...\n");

  // Validate environment variables
  if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
    console.error("❌ Error: HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env");
    process.exit(1);
  }

  try {
    // Initialize Hedera client
    console.log("📡 Connecting to Hedera Testnet...");
    const client = Client.forTestnet();
    
    // Parse the private key - handle both HEX and DER formats
    let privateKey;
    const keyString = process.env.HEDERA_OPERATOR_KEY;
    
    if (keyString.startsWith('0x')) {
      // HEX format - try ED25519 first
      privateKey = PrivateKey.fromStringED25519(keyString);
    } else if (keyString.startsWith('302e') || keyString.startsWith('3030')) {
      // DER format
      privateKey = PrivateKey.fromStringDer(keyString);
    } else {
      // Try auto-detect
      privateKey = PrivateKey.fromString(keyString);
    }
    
    client.setOperator(
      AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
      privateKey
    );
    console.log("✅ Connected to Hedera Testnet\n");

    // Check account balance
    try {
      const accountId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
      const balance = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(client);
      console.log(`💰 Account Balance: ${balance.hbars.toString()}\n`);

      if (balance.hbars.toTinybars().toNumber() < 100_000_000) { // Less than 1 HBAR
        console.warn("⚠️  Warning: Low balance. You may need more HBAR for setup.");
        console.warn("   Visit: https://portal.hedera.com/faucet\n");
      }
    } catch (balanceError) {
      console.log("💰 Skipping balance check...\n");
    }

    const envUpdates: string[] = [];

    // ============================================
    // 1. CREATE HCS TOPICS
    // ============================================
    console.log("📝 Creating HCS Topics...\n");

    // Audit Topic
    console.log("  Creating Audit Trail Topic...");
    const auditTopicTx = await new TopicCreateTransaction()
      .setTopicMemo("MediBridge - Audit Trail")
      .setAdminKey(client.operatorPublicKey!)
      .execute(client);
    const auditTopicReceipt = await auditTopicTx.getReceipt(client);
    const auditTopicId = auditTopicReceipt.topicId!.toString();
    console.log(`  ✅ Audit Topic ID: ${auditTopicId}`);
    envUpdates.push(`HEDERA_AUDIT_TOPIC_ID=${auditTopicId}`);

    // Consent Topic
    console.log("  Creating Consent Events Topic...");
    const consentTopicTx = await new TopicCreateTransaction()
      .setTopicMemo("MediBridge - Consent Events")
      .setAdminKey(client.operatorPublicKey!)
      .execute(client);
    const consentTopicReceipt = await consentTopicTx.getReceipt(client);
    const consentTopicId = consentTopicReceipt.topicId!.toString();
    console.log(`  ✅ Consent Topic ID: ${consentTopicId}`);
    envUpdates.push(`HEDERA_CONSENT_TOPIC_ID=${consentTopicId}`);

    // Security Topic
    console.log("  Creating Security Violations Topic...");
    const securityTopicTx = await new TopicCreateTransaction()
      .setTopicMemo("MediBridge - Security Violations")
      .setAdminKey(client.operatorPublicKey!)
      .execute(client);
    const securityTopicReceipt = await securityTopicTx.getReceipt(client);
    const securityTopicId = securityTopicReceipt.topicId!.toString();
    console.log(`  ✅ Security Topic ID: ${securityTopicId}\n`);
    envUpdates.push(`HEDERA_SECURITY_TOPIC_ID=${securityTopicId}`);

    // ============================================
    // 2. CREATE NFT TOKEN
    // ============================================
    console.log("🎨 Creating Medical Record NFT Token...\n");

    // Generate keys for NFT
    const supplyKey = PrivateKey.generateED25519();
    const freezeKey = PrivateKey.generateED25519();

    console.log("  Generating NFT keys...");
    console.log(`  Supply Key: ${supplyKey.toString()}`);
    console.log(`  Freeze Key: ${freezeKey.toString()}\n`);

    console.log("  Creating NFT token...");
    const nftCreateTx = await new TokenCreateTransaction()
      .setTokenName("MediBridge Medical Record")
      .setTokenSymbol("MBMR")
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(client.operatorAccountId!)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(supplyKey)
      .setFreezeKey(freezeKey)
      .setFreezeDefault(false)
      .setAdminKey(client.operatorPublicKey!)
      .execute(client);

    const nftCreateReceipt = await nftCreateTx.getReceipt(client);
    const nftTokenId = nftCreateReceipt.tokenId!.toString();
    console.log(`  ✅ NFT Token ID: ${nftTokenId}\n`);

    envUpdates.push(`HEDERA_MEDICAL_NFT_TOKEN_ID=${nftTokenId}`);
    envUpdates.push(`HEDERA_NFT_SUPPLY_KEY=${supplyKey.toString()}`);
    envUpdates.push(`HEDERA_NFT_FREEZE_KEY=${freezeKey.toString()}`);

    // ============================================
    // 3. UPDATE .ENV FILE
    // ============================================
    console.log("📄 Updating .env file...\n");

    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Add or update each variable
    for (const update of envUpdates) {
      const [key, value] = update.split("=");
      const regex = new RegExp(`^${key}=.*$`, "m");
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, update);
      } else {
        envContent += `\n${update}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ .env file updated successfully!\n");

    // ============================================
    // 4. SUMMARY
    // ============================================
    console.log("=" .repeat(60));
    console.log("🎉 HEDERA SETUP COMPLETE!");
    console.log("=" .repeat(60));
    console.log("\n📋 Created Resources:\n");
    console.log(`  Audit Topic:    ${auditTopicId}`);
    console.log(`  Consent Topic:  ${consentTopicId}`);
    console.log(`  Security Topic: ${securityTopicId}`);
    console.log(`  NFT Token:      ${nftTokenId}`);
    console.log("\n🔑 Keys Generated:\n");
    console.log(`  Supply Key:  ${supplyKey.toString()}`);
    console.log(`  Freeze Key:  ${freezeKey.toString()}`);
    console.log("\n✅ All credentials saved to .env file");
    console.log("\n🚀 Next Steps:");
    console.log("  1. Run: npm install @hashgraph/sdk");
    console.log("  2. Restart your development server");
    console.log("  3. Hedera integration is ready to use!");
    console.log("\n" + "=" .repeat(60) + "\n");

    client.close();
  } catch (error: any) {
    console.error("\n❌ Setup failed:", error.message);
    console.error("\nTroubleshooting:");
    console.error("  1. Check your HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env");
    console.error("  2. Ensure you have sufficient HBAR balance");
    console.error("  3. Visit https://portal.hedera.com/faucet to get testnet HBAR");
    process.exit(1);
  }
}

// Run setup
setupHedera();
