/**
 * Aadhaar Verification Service — on-device OCR (no database)
 *
 * Uses Google ML Kit Text Recognition to scan the Aadhaar card image
 * directly on the device.  No external API or mock database required.
 *
 * Flow:
 *   1. User photographs / uploads their physical Aadhaar card.
 *   2. User types their 12-digit Aadhaar number and full name.
 *   3. ML Kit OCR extracts all text from the card image.
 *   4. The typed number is matched against numbers found in the image.
 *   5. At least one name part must appear in the OCR text.
 */

import TextRecognition from '@react-native-ml-kit/text-recognition';

function normalise(aadhaar) {
  return aadhaar.replace(/[\s\-]/g, "");
}

export function isValidAadhaarFormat(aadhaar) {
  return /^\d{12}$/.test(normalise(aadhaar));
}

/**
 * Runs ML Kit OCR on the card image and returns every 12-digit number found.
 * Handles both spaced format (XXXX XXXX XXXX) and continuous runs.
 */
async function scanCardImage(imageUri) {
  const result = await TextRecognition.recognize(imageUri);
  const text = result.text || "";
  const numbers = new Set();

  // Spaced format: XXXX XXXX XXXX
  const spacedRe = /\b(\d{4})\s+(\d{4})\s+(\d{4})\b/g;
  let m;
  while ((m = spacedRe.exec(text)) !== null) {
    numbers.add(m[1] + m[2] + m[3]);
  }

  // Continuous 12-digit block
  const solidRe = /\b(\d{12})\b/g;
  while ((m = solidRe.exec(text)) !== null) {
    numbers.add(m[1]);
  }

  return { numbers: [...numbers], fullText: text };
}

/**
 * Verifies an Aadhaar card by comparing the typed number and name against
 * what is physically printed on the card image — no database required.
 *
 * @param {string} aadhaarNumber  12-digit number typed by the user
 * @param {string} enteredName    Name typed by the user
 * @param {string} imageUri       URI of the Aadhaar card photo
 */
export async function verifyAadhaarCard(aadhaarNumber, enteredName, imageUri) {
  const key = normalise(aadhaarNumber);
  if (!isValidAadhaarFormat(key))
    return { success: false, error: "Aadhaar number must be exactly 12 digits." };

  if (!imageUri)
    return { success: false, error: "Aadhaar card image is required." };

  let ocrData;
  try {
    ocrData = await scanCardImage(imageUri);
  } catch (e) {
    return { success: false, error: "Could not read the card image. Please take a clearer, well-lit photo." };
  }

  const { numbers, fullText } = ocrData;

  // 1. The typed Aadhaar number must be present in the image
  if (!numbers.includes(key)) {
    return {
      success: false,
      error: "Aadhaar number not found on the card image. Re-enter the number or take a clearer photo.",
    };
  }

  // 2. At least one meaningful name part must appear in the OCR text
  const ocrLower = fullText.toLowerCase();
  const nameParts = enteredName.trim().toLowerCase().split(/\s+/);
  const nameFound = nameParts.some((part) => part.length > 2 && ocrLower.includes(part));

  if (!nameFound) {
    return {
      success: false,
      error: `Name "${enteredName}" was not found on the card. Check your spelling or take a clearer photo.`,
    };
  }

  // Build a record from the verified on-card data (no DB lookup needed)
  const firstName = nameParts[0];
  const record = {
    name: firstName,
    displayName: enteredName.trim(),
    dob: null,
    gender: null,
    address: "Verified from Aadhaar card image",
  };

  return { success: true, record };
}

/**
 * Compares the live selfie captured from the front camera against the
 * Aadhaar card photo.  In production this calls an on-device ML face-
 * matching API (e.g. @react-native-ml-kit/face-detection).
 *
 * @param {string} selfieUri  URI of the captured selfie photo
 */
export async function simulateFaceMatch(selfieUri) {
  if (!selfieUri) {
    return { matched: false, confidence: 0, error: "No selfie captured." };
  }
  // TODO: replace with real face-comparison ML call using selfieUri
  await new Promise((r) => setTimeout(r, 2000));
  return { matched: true, confidence: 0.94 };
}

/**
 * Checks whether the supplied username matches the name registered
 * with this Aadhaar card (case-insensitive, trims spaces).
 */
export function doesUsernameMatchAadhaar(username, aadhaarRecord) {
  const u = username.trim().toLowerCase();
  const n = aadhaarRecord.name.toLowerCase();
  return u === n || u.startsWith(n) || n.startsWith(u);
}

/**
 * Returns a partially masked display version of the Aadhaar number.
 * e.g. "XXXX XXXX 9012"
 */
export function maskAadhaar(aadhaar) {
  const d = normalise(aadhaar);
  return "XXXX XXXX " + d.slice(8);
}

/**
 * Returns a partially masked display name.
 * e.g. "Rahul Kumar" → "R**** K****"
 */
export function maskName(displayName) {
  return displayName
    .split(" ")
    .map((w) => (w.length > 1 ? w[0] + "*".repeat(w.length - 1) : w))
    .join(" ");
}
