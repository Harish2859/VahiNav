/**
 * @fileoverview Simple logging utility.
 *
 * Provides lightweight logging helpers that prefix every message with an
 * ISO-8601 timestamp and a severity level.  Can be replaced with Winston or
 * Pino in a future iteration without changing call sites.
 */

'use strict';

/**
 * Returns the current UTC date-time as an ISO-8601 string enclosed in square
 * brackets — suitable for log line prefixes.
 *
 * @returns {string}  e.g. "[2026-03-02T10:30:45.123Z]"
 */
function ts() {
  return `[${new Date().toISOString()}]`;
}

/**
 * Log an informational message.
 *
 * @param {string} context - Module or subsystem name, e.g. "Server" or "DB"
 * @param {...*}   args    - Values passed directly to console.log
 */
function info(context, ...args) {
  console.log(ts(), `[${context}]`, ...args);
}

/**
 * Log a warning message.
 *
 * @param {string} context
 * @param {...*}   args
 */
function warn(context, ...args) {
  console.warn(ts(), `[WARN][${context}]`, ...args);
}

/**
 * Log an error message.
 *
 * @param {string} context
 * @param {...*}   args
 */
function error(context, ...args) {
  console.error(ts(), `[ERROR][${context}]`, ...args);
}

/**
 * Log an HTTP request/response summary.
 *
 * Intended to be called from Express middleware to produce one log line per
 * request in the format:
 *   [timestamp] [HTTP] METHOD /path → STATUS DURATIONms
 *
 * @param {string} method     - HTTP method, e.g. "GET"
 * @param {string} url        - Request URL
 * @param {number} statusCode - HTTP response status code
 * @param {number} durationMs - Request processing duration in milliseconds
 */
function request(method, url, statusCode, durationMs) {
  console.log(ts(), `[HTTP] ${method} ${url} → ${statusCode} ${durationMs}ms`);
}

module.exports = { info, warn, error, request };
