/**
 * Standard API Response Class
 * Provides consistent response format
 * 
 * @module utils/ApiResponse
 */

/**
 * API Response class
 * Creates standardized response objects
 */
export class ApiResponse {
  /**
   * Create an API response
   * 
   * @param {boolean} success - Success status
   * @param {*} data - Response data
   * @param {string} message - Response message
   */
  constructor(success, data = null, message = '') {
    this.success = success;
    this.data = data;
    this.message = message;
  }
}