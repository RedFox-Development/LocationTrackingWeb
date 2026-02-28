/**
 * Data URI utility functions
 */

/**
 * Parse a data URI and extract base64 data and MIME type
 * @param {string} dataUri - Data URI (e.g., "data:image/png;base64,iVBORw0KG...")
 * @returns {Object} Object with base64Data and mimeType, or null if invalid
 */
export function parseDataUri(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') {
    return null;
  }

  // Check if it's a data URI
  if (!dataUri.startsWith('data:')) {
    return null;
  }

  try {
    // Extract MIME type and base64 data
    // Format: data:image/png;base64,iVBORw0KGgo...
    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    
    if (!matches) {
      return null;
    }

    return {
      mimeType: matches[1],
      base64Data: matches[2]
    };
  } catch (error) {
    console.error('Error parsing data URI:', error);
    return null;
  }
}

/**
 * Convert image data to data URI for display
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} mimeType - MIME type (e.g., "image/png")
 * @returns {string} Data URI string
 */
export function toDataUri(base64Data, mimeType) {
  if (!base64Data || !mimeType) {
    return null;
  }
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Fetch an image from a URL and convert it to a data URI
 * @param {string} url - Image URL (http:// or https://)
 * @returns {Promise<string>} Data URI string
 */
export async function fetchImageAsDataUri(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Enable cross-origin if possible
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Convert to data URI (defaults to PNG)
        const dataUri = canvas.toDataURL('image/png');
        resolve(dataUri);
      } catch (error) {
        reject(new Error(`Failed to convert image to base64: ${error.message}`));
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image. The URL may be invalid or the server does not allow cross-origin requests. Try uploading the image file directly instead.'));
    };
    
    // Start loading the image
    img.src = url;
  });
}

// Helper function to convert base64 + mime type to data URI
export const getImageDataUri = (base64Data, mimeType) => {
  if (!base64Data) return null
  if (base64Data.startsWith('data:')) return base64Data // Already a data URI
  return `data:${mimeType || 'image/jpeg'};base64,${base64Data}`
}