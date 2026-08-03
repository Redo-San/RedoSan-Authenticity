const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Load id_forge.js via vm.runInThisContext (not require) so var-level
// declarations like hex, uuidv4, etc. become globals, matching browser behaviour
const src = fs.readFileSync(path.join(__dirname, "../../ID_Forge/id_forge.js"), "utf8");
vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../ID_Forge/id_forge.js") });

console.log('typeof hex:', typeof hex);
console.log('typeof uuidv4:', typeof uuidv4);
console.log('typeof sanitizeText:', typeof sanitizeText);
console.log('typeof extractHashFromOts:', typeof extractHashFromOts);
console.log('typeof hexFromDigest:', typeof hexFromDigest);
console.log('hex(255,2):', hex(255, 2));
console.log('hex(10,4):', hex(10, 4));