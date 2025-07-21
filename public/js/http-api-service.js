/**
 * HTTP API Service for SwimWatch Application
 * Handles only REST API calls - WebSocket functionality remains separate
 */
export class HttpApiService {
    constructor() {
        // No WebSocket-related properties
    }

    // ------------------------------------------------------------------
    // REST API Methods
    // ------------------------------------------------------------------

    /**
     * Generic fetch wrapper with error handling
     * @param {string} url - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            console.error(`API request failed for ${url}:`, error);
            throw error;
        }
    }

    /**
     * Get events list for a session
     * @param {number|null} sessionId - Session ID (optional)
     * @returns {Promise<Array>} Events array
     */
    async getEvents(sessionId = null) {
        const sessionParam = sessionId ? `?session=${sessionId}` : '';
        return await this.request(`/competition/event${sessionParam}`);
    }

    /**
     * Get specific event data
     * @param {number} eventNr - Event number
     * @param {number|null} sessionId - Session ID (optional)
     * @returns {Promise<object>} Event data
     */
    async getEvent(eventNr, sessionId = null) {
        const sessionParam = sessionId ? `?session=${sessionId}` : '';
        return await this.request(`/competition/event/${eventNr}${sessionParam}`);
    }

    /**
     * Get heat data for specific event and heat
     * @param {number} eventNr - Event number
     * @param {number} heatNr - Heat number
     * @param {number|null} sessionId - Session ID (optional)
     * @returns {Promise<object>} Heat data
     */
    async getHeat(eventNr, heatNr, sessionId = null) {
        const sessionParam = sessionId ? `?session=${sessionId}` : '';
        return await this.request(`/competition/event/${eventNr}/heat/${heatNr}${sessionParam}`);
    }

    /**
     * Get sessions list
     * @returns {Promise<Array>} Sessions array
     */
    async getSessions() {
        return await this.request('/competition/sessions');
    }

    /**
     * Get competition summary
     * @returns {Promise<object>} Competition summary
     */
    async getCompetitionSummary() {
        return await this.request('/competition/summary');
    }

    /**
     * Get log file content
     * @returns {Promise<string>} Log content
     */
    async getLogContent() {
        return await this.request('/logs/competition.log', { cache: 'no-store' });
    }
}

// Export default instance
export default new HttpApiService();
