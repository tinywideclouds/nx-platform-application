/**
 * tools/scripts/provision-secrets.mjs
 * * USAGE:
 * node tools/scripts/provision-secrets.mjs <PROJECT_ID>
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { createInterface } from 'node:readline';

// --- CONFIGURATION ---
const args = process.argv.slice(2);
const PROJECT_ID = args[0];

if (!PROJECT_ID) {
  console.error('❌ Error: Please provide the GCP Project ID as an argument.');
  console.log('Usage: node tools/scripts/provision-secrets.mjs <PROJECT_ID>');
  process.exit(1);
}

// Instantiate the client (Auth is handled via ADC - 'gcloud auth application-default login')
const client = new SecretManagerServiceClient();

console.log(`🔒 Starting Zero-Knowledge Provisioning for: ${PROJECT_ID}\n`);

// --- HELPER: Securely Upload to Secret Manager ---
async function uploadSecret(name, secretValue) {
  const parent = `projects/${PROJECT_ID}`;
  const secretName = `${parent}/secrets/${name}`;

  try {
    // Attempt to add the secret version immediately
    await addSecretVersion(secretName, secretValue);
    console.log(`✅ [${name}]: Uploaded successfully.`);
  } catch (err) {
    // If the secret itself doesn't exist (Error code 5 is NOT_FOUND), create it first
    if (err.code === 5 || err.message.includes('NOT_FOUND')) {
      console.log(`⚠️  [${name}]: Secret definition not found. Creating it...`);
      try {
        await createSecret(parent, name);
        await addSecretVersion(secretName, secretValue);
        console.log(`✅ [${name}]: Uploaded successfully (after creation).`);
      } catch (creationErr) {
        console.error(
          `❌ [${name}]: Failed to create secret.`,
          creationErr.message
        );
        throw creationErr;
      }
    } else {
      console.error(`❌ [${name}]: Failed to add version.`, err.message);
      throw err;
    }
  }
}

// Helper to add the actual payload (the value)
async function addSecretVersion(parent, payloadStr) {
  const [version] = await client.addSecretVersion({
    parent: parent,
    payload: {
      data: Buffer.from(payloadStr, 'utf8'),
    },
  });
  return version;
}

// Helper to create the secret container
async function createSecret(parent, secretId) {
  const [secret] = await client.createSecret({
    parent: parent,
    secretId: secretId,
    secret: {
      replication: {
        automatic: {},
      },
    },
  });
  return secret;
}

// --- GENERATORS ---

function generateRandomKey() {
  // Generates a 32-byte (256-bit) secure random string
  return randomBytes(32).toString('base64');
}

function generateRsaKey() {
  // Generates a standard PEM private key
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return privateKey;
}

// --- MAIN WORKFLOW ---

async function run() {
  try {
    // 1. Internal Secrets (Generated on the fly, never seen by humans)
    console.log('--- Generating & Uploading Internal Secrets ---');

    // Parallelize uploads for speed
    await Promise.all([
      uploadSecret('SESSION_SECRET', generateRandomKey()),
      uploadSecret('JWT_SECRET', generateRandomKey()),
      uploadSecret('INTERNAL_API_KEY', generateRandomKey()),
      uploadSecret('JWT_PRIVATE_KEY', generateRsaKey()),
    ]);

    // 2. External Secrets (Prompted)
    console.log('\n--- External Secrets Input ---');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      'Enter GOOGLE_CLIENT_SECRET (Input will be hidden): ',
      async (answer) => {
        console.log(
          '\r(Input received)                                        '
        );

        if (!answer.trim()) {
          console.error('❌ Skipping GOOGLE_CLIENT_SECRET (empty input)');
        } else {
          await uploadSecret('GOOGLE_CLIENT_SECRET', answer.trim());
        }

        rl.close();
        console.log('\n✨ All secrets provisioned successfully!');
      }
    );

    // Rudimentary "hidden" input mask logic
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.history.length > 0) return;
    };
  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

run();
