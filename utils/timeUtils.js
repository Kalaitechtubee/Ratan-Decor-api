// Time utility functions for AM/PM format handling

/**
 * Convert 24-hour time format to 12-hour AM/PM format
 * @param {string} time24 - Time in 24-hour format (HH:mm or HH:mm:ss)
 * @returns {string} Time in 12-hour AM/PM format
 */
const convertTo12Hour = (time24) => {
  if (!time24) return '';

  // Handle different time formats
  const timeParts = time24.split(':');
  let hours = parseInt(timeParts[0]);
  const minutes = timeParts[1] || '00';

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12

  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Convert 12-hour AM/PM format to 24-hour format
 * @param {string} time12 - Time in 12-hour AM/PM format (e.g., "2:30 PM")
 * @returns {string} Time in 24-hour format (HH:mm)
 */
const convertTo24Hour = (time12) => {
  if (!time12) return '';

  // Parse the time string
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12; // Return as-is if not in expected format

  let [, hours, minutes, ampm] = match;
  hours = parseInt(hours);
  minutes = minutes || '00';

  if (ampm.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

/**
 * Validate time format (accepts both 12-hour and 24-hour formats)
 * @param {string} time - Time string to validate
 * @returns {boolean} True if valid time format
 */
const isValidTime = (time) => {
  if (!time) return false;

  // Check 24-hour format (HH:mm or HH:mm:ss)
  const time24Regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (time24Regex.test(time)) return true;

  // Check 12-hour format (H:mm AM/PM or HH:mm AM/PM)
  const time12Regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
  return time12Regex.test(time);
};

/**
 * Format time for display (converts to 12-hour format if needed)
 * @param {string} time - Time string
 * @returns {string} Formatted time string
 */
const formatTimeForDisplay = (time) => {
  if (!time) return '';

  // If already in 12-hour format, return as-is
  if (time.includes('AM') || time.includes('PM')) {
    return time;
  }

  // Convert from 24-hour to 12-hour format
  return convertTo12Hour(time);
};

/**
 * Format time for storage (converts to 24-hour format if needed)
 * @param {string} time - Time string
 * @returns {string} Time in 24-hour format
 */
const formatTimeForStorage = (time) => {
  if (!time) return '';

  // If already in 24-hour format, return as-is
  if (!time.includes('AM') && !time.includes('PM')) {
    return time;
  }

  // Convert from 12-hour to 24-hour format
  return convertTo24Hour(time);
};

module.exports = {
  convertTo12Hour,
  convertTo24Hour,
  isValidTime,
  formatTimeForDisplay,
  formatTimeForStorage
};
