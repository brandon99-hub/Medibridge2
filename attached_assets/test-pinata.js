import PinataClient from '@pinata/sdk';

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataJWT = process.env.PINATA_JWT;

const pinata = pinataJWT
  ? new PinataClient({ pinataJWTKey: pinataJWT })
  : new PinataClient(pinataApiKey, pinataSecretApiKey);

async function testPin() {
  try {
    const result = await pinata.pinJSONToIPFS({ hello: 'world', timestamp: new Date().toISOString() });
    console.log('Pin successful! CID:', result.IpfsHash);
  } catch (error) {
    console.error('Pinata test failed:', error && (error.response?.data || error.message || error));
  }
}

testPin(); 