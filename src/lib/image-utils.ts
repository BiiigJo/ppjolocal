
/**
 * Compresses a base64 image string by resizing it and reducing quality.
 * This is crucial for staying within LocalStorage (5MB) and Firestore (1MB) limits.
 */
export async function compressImage(base64Str: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<string> {
  // If it's already a tiny string or empty, avoid processing
  if (!base64Str || base64Str.length < 100) return base64Str;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Output as compressed JPEG
        const result = canvas.toDataURL("image/jpeg", quality);
        resolve(result);
      } catch (err) {
        console.error("Compression error in onload:", err);
        reject(err);
      }
    };
    img.onerror = (err) => {
      console.error("Image loading error for compression:", err);
      reject(new Error("Image loading failed"));
    };
  });
}

/**
 * Generates a simple hash for a string (like base64 image) to help with deduplication.
 */
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
