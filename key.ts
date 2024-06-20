import * as crypto from "crypto";
import { ec } from "elliptic";

const secp256k1 = new ec("secp256k1");
const entropy = crypto.randomBytes(32);
const keyPair = secp256k1.genKeyPair({ entropy });
const priv = keyPair.getPrivate("hex");
const pub = keyPair.getPublic(true, "hex");

console.log(`privateKey: ${priv}`);
console.log(`publicKey: ${pub}`);
