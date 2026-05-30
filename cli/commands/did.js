'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function runDid(action, file, opts) {
  if (action === 'generate') {
    const algo = (opts.algo || 'Ed25519').toUpperCase();
    let keyPair;
    if (algo === 'ED25519') {
      const { generateKeyPairSync } = crypto;
      keyPair = generateKeyPairSync('ed25519', {
        privateKey: { format: 'pem' },
        publicKey: { format: 'pem' },
      });
    } else if (algo === 'P-256') {
      const { generateKeyPairSync } = crypto;
      keyPair = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        privateKey: { format: 'pem' },
        publicKey: { format: 'pem' },
      });
    } else {
      console.error('Unsupported algorithm. Use Ed25519 or P-256.');
      process.exit(1);
    }

    const did = `did:key:${algo === 'ED25519' ? 'z' : 'z'}${Buffer.from(keyPair.publicKey).toString('base64url').substring(0, 32)}`;
    const output = {
      did,
      algorithm: algo,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      created: new Date().toISOString(),
    };
    const outPath = opts.output ? path.resolve(opts.output) : path.resolve('did-identity.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`DID generated: ${did}`);
    console.log(`Saved to: ${outPath}`);
    console.log('⚠️  Keep your private key secure!');

  } else if (action === 'sign') {
    if (!file) {
      console.error('File argument required for sign mode');
      process.exit(1);
    }
    const absPath = path.resolve(file);
    if (!fs.existsSync(absPath)) {
      console.error('File not found:', absPath);
      process.exit(1);
    }

    const data = fs.readFileSync(absPath);
    const hash = crypto.createHash('sha256').update(data).digest();

    let didIdentity = null;
    const didPaths = ['./did-identity.json', path.join(process.env.HOME || process.env.USERPROFILE || '.', '.redosan', 'did-identity.json')];
    for (const p of didPaths) {
      try {
        didIdentity = JSON.parse(fs.readFileSync(path.resolve(p), 'utf-8'));
        break;
      } catch (e) {}
    }
    if (!didIdentity) {
      console.error('No DID identity found. Generate one first with "redosan did generate".');
      process.exit(1);
    }

    const sign = crypto.createSign('SHA256');
    sign.update(hash);
    const signature = sign.sign(didIdentity.privateKey, 'base64');

    const sigOutput = {
      file: path.basename(absPath),
      fileHash: hash.toString('hex'),
      did: didIdentity.did,
      algorithm: didIdentity.algorithm,
      signature,
      signed: new Date().toISOString(),
    };
    const outPath = opts.output ? path.resolve(opts.output) : path.resolve(absPath + '.sig.json');
    fs.writeFileSync(outPath, JSON.stringify(sigOutput, null, 2));
    console.log(`File signed with ${didIdentity.did}`);
    console.log(`Signature saved to: ${outPath}`);
  }
}

module.exports = { runDid };
