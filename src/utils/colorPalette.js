/**
 * Color Palette for Team Management
 * Pre-defined colors optimized for map markers and visibility
 */

// Array of visually distinct colors optimized for map visibility
export const TEAM_COLORS = [
  '#FF5A5F', // Bright Coral Red
  '#FF7A00', // Vivid Orange
  '#FFB000', // Sunburst Yellow
  '#FFD93D', // Bright Lemon
  '#7ED957', // Bright Lime Green
  '#2ECC71', // Fresh Green
  '#00C2A8', // Bright Teal
  '#00D2D3', // Electric Cyan
  '#20A4F3', // Bright Azure
  '#3A86FF', // Vivid Blue
  '#5E60CE', // Indigo Blue
  '#7B61FF', // Bright Indigo
  '#9B5DE5', // Bright Violet
  '#C77DFF', // Orchid Purple
  '#F15BB5', // Hot Pink
  '#FF66C4', // Bubblegum Pink
  '#FF8FAB', // Bright Rose
  '#FB5607', // Strong Orange Red
  '#06D6A0', // Neon Mint
  '#00BBF9', // Bright Sky Blue
  '#4CC9F0', // Clear Cyan
  '#43AA8B', // Fresh Jade
  '#90BE6D', // Bright Moss Green
  '#F8961E', // Marigold
  '#F94144', // Bright Red
  '#577590', // Steel Blue
  '#4361EE', // Royal Blue
  '#B5179E', // Magenta
];

/**
 * Get a random color from the predefined palette
 * @returns {string} Hex color code
 */
export function getRandomColor() {
  const randomIndex = Math.floor(Math.random() * TEAM_COLORS.length);
  return TEAM_COLORS[randomIndex];
}

/**
 * Get the next unused color from the palette
 * @param {Array<string>} usedColors - Array of already used color hex codes
 * @returns {string} Hex color code
 */
export function getNextAvailableColor(usedColors = []) {
  // Find first color not in usedColors
  const availableColor = TEAM_COLORS.find(color => !usedColors.includes(color));
  
  // If all colors are used, return a random one
  return availableColor || getRandomColor();
}

/**
 * Get multiple distinct colors
 * @param {number} count - Number of colors needed
 * @returns {Array<string>} Array of hex color codes
 */
export function getDistinctColors(count) {
  const shuffled = [...TEAM_COLORS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, TEAM_COLORS.length));
}
