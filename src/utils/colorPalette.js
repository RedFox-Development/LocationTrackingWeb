/**
 * Color Palette for Team Management
 * Pre-defined colors optimized for map markers and visibility
 */

// Array of visually distinct colors optimized for map visibility
export const TEAM_COLORS = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Sky Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint Green
  '#F7DC6F', // Sunny Yellow
  '#BB8FCE', // Lavender
  '#85C1E2', // Powder Blue
  '#FAD7A0', // Peach
  '#AED6F1', // Light Blue
  '#F8B4B4', // Pink
  '#7FDBDA', // Aqua
  '#82E0AA', // Light Green
  '#F9E79F', // Cream Yellow
  '#D7BDE2', // Light Purple
  '#A9DFBF', // Pale Green
  '#FAD02C', // Golden Yellow
  '#45B39D', // Teal
  '#F39C12', // Orange
  '#8E44AD', // Purple
  '#3498DB', // Blue
  '#E74C3C', // Red
  '#1ABC9C', // Sea Green
  '#F06292', // Rose Pink
  '#9575CD', // Medium Purple
  '#4DB6AC', // Teal Blue
  '#FFB74D', // Light Orange
  '#A1887F', // Brown Grey
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
