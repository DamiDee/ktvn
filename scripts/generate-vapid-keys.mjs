// Run once: node scripts/generate-vapid-keys.mjs
// Copy the output into your .env.local file.
import webpush from "web-push";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@k-rides.app`);
