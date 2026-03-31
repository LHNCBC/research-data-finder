/**
 * Prepares a string for insertion into a regular expression
 * @param {string} str - the string to escape
 * @returns {string} the escaped string
 */
module.exports = function escapeStringForRegExp(str) {
  return str.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&');
}
