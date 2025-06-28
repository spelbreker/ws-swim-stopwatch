/**
 * Robust Time Synchronization Module
 * 
 * Implements a Network Time Protocol (NTP) inspired algorithm for accurate
 * time synchronization between client and server across different devices.
 * 
 * Features:
 * - Multiple measurements for statistical accuracy
 * - Outlier filtering based on RTT thresholds
 * - Gradual offset adjustment to avoid sudden jumps
 * - Comprehensive logging for debugging
 */

class TimeSync {
    constructor(options = {}) {
        // Configuration options
        this.maxSamples = options.maxSamples || 8;
        this.maxRTT = options.maxRTT || 200; // milliseconds - filter out high latency samples
        this.smoothingFactor = options.smoothingFactor || 0.1; // How quickly to adjust offset
        this.initialSyncCount = options.initialSyncCount || 5; // Number of quick syncs on startup
        this.debugLogging = options.debugLogging !== false; // Enable debug logging by default
        
        // State variables
        this.samples = [];
        this.currentOffset = 0;
        this.isInitialSync = true;
        this.syncCount = 0;
        this.lastSyncTime = 0;
        
        // Callbacks
        this.onOffsetUpdate = options.onOffsetUpdate || null;
        this.onPingUpdate = options.onPingUpdate || null;
    }
    
    /**
     * Process a time sync message from the server
     * @param {Object} message - The time sync message
     * @param {number} message.server_time - Server timestamp
     * @param {number} message.client_ping_time - Client ping time (for pong messages)
     * @param {string} message.type - Message type ('pong' or 'time_sync')
     */
    processTimeSync(message) {
        const now = Date.now();
        let rtt = 0;
        
        // Calculate RTT for pong messages
        if (message.type === 'pong' && message.client_ping_time) {
            rtt = now - message.client_ping_time;
            
            // Update ping display if callback provided
            if (this.onPingUpdate) {
                this.onPingUpdate(rtt);
            }
            
            // Filter out samples with high RTT
            if (rtt > this.maxRTT) {
                if (this.debugLogging) {
                    console.log(`[TimeSync] Filtering high RTT sample: ${rtt}ms`);
                }
                return;
            }
        }
        
        // Calculate estimated server time when message was received
        const estimatedServerTimeNow = message.server_time + (rtt / 2);
        const rawOffset = estimatedServerTimeNow - now;
        
        // Add sample to collection
        this.addSample({
            rawOffset,
            rtt,
            timestamp: now,
            serverTime: message.server_time
        });
        
        // Calculate new offset
        this.updateOffset();
        
        // Log the sync
        if (this.debugLogging) {
            console.log(`[TimeSync] Sample added - RTT: ${rtt}ms, Raw offset: ${rawOffset}ms, Filtered offset: ${this.currentOffset}ms`);
        }
    }
    
    /**
     * Add a time sample to the collection
     */
    addSample(sample) {
        this.samples.push(sample);
        this.syncCount++;
        
        // Remove oldest samples if we exceed max
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
        
        // Mark initial sync as complete after enough samples
        if (this.isInitialSync && this.syncCount >= this.initialSyncCount) {
            this.isInitialSync = false;
            if (this.debugLogging) {
                console.log(`[TimeSync] Initial synchronization complete after ${this.syncCount} samples`);
            }
        }
    }
    
    /**
     * Update the current time offset using statistical filtering
     */
    updateOffset() {
        if (this.samples.length === 0) return;
        
        // Get valid samples (filter outliers)
        const validSamples = this.filterOutliers(this.samples);
        
        if (validSamples.length === 0) {
            if (this.debugLogging) {
                console.warn('[TimeSync] No valid samples after filtering');
            }
            return;
        }
        
        // Calculate weighted average offset
        const newOffset = this.calculateWeightedOffset(validSamples);
        
        // Apply smoothing during normal operation (not initial sync)
        if (this.isInitialSync || this.syncCount <= this.initialSyncCount) {
            // During initial sync, adjust more aggressively
            this.currentOffset = newOffset;
        } else {
            // During normal operation, smooth the adjustment
            const offsetDelta = newOffset - this.currentOffset;
            this.currentOffset += offsetDelta * this.smoothingFactor;
        }
        
        // Notify callback of offset update
        if (this.onOffsetUpdate) {
            this.onOffsetUpdate(this.currentOffset);
        }
        
        this.lastSyncTime = Date.now();
    }
    
    /**
     * Filter outlier samples based on RTT and offset deviation
     */
    filterOutliers(samples) {
        if (samples.length <= 2) return samples;
        
        // Filter by RTT first
        const lowRTTSamples = samples.filter(sample => sample.rtt <= this.maxRTT);
        
        if (lowRTTSamples.length <= 2) return lowRTTSamples;
        
        // Calculate median offset for outlier detection
        const offsets = lowRTTSamples.map(s => s.rawOffset).sort((a, b) => a - b);
        const median = offsets[Math.floor(offsets.length / 2)];
        
        // Calculate standard deviation
        const mean = offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length;
        const variance = offsets.reduce((sum, offset) => sum + Math.pow(offset - mean, 2), 0) / offsets.length;
        const stdDev = Math.sqrt(variance);
        
        // Filter samples that are more than 2 standard deviations from median
        const filtered = lowRTTSamples.filter(sample => {
            const deviation = Math.abs(sample.rawOffset - median);
            return deviation <= (2 * stdDev + 10); // +10ms tolerance
        });
        
        return filtered.length > 0 ? filtered : lowRTTSamples;
    }
    
    /**
     * Calculate weighted average offset, giving more weight to samples with lower RTT
     */
    calculateWeightedOffset(samples) {
        if (samples.length === 1) return samples[0].rawOffset;
        
        let totalWeight = 0;
        let weightedSum = 0;
        
        samples.forEach(sample => {
            // Weight inversely proportional to RTT (lower RTT = higher weight)
            const weight = 1 / (sample.rtt + 1); // +1 to avoid division by zero
            weightedSum += sample.rawOffset * weight;
            totalWeight += weight;
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    
    /**
     * Get the current synchronized time
     */
    getSynchronizedTime() {
        return Date.now() + this.currentOffset;
    }
    
    /**
     * Get the current time offset
     */
    getOffset() {
        return this.currentOffset;
    }
    
    /**
     * Get synchronization statistics
     */
    getStats() {
        return {
            sampleCount: this.samples.length,
            syncCount: this.syncCount,
            currentOffset: this.currentOffset,
            isInitialSync: this.isInitialSync,
            lastSyncTime: this.lastSyncTime,
            avgRTT: this.samples.length > 0 
                ? this.samples.reduce((sum, s) => sum + s.rtt, 0) / this.samples.length 
                : 0
        };
    }
    
    /**
     * Reset the synchronization state
     */
    reset() {
        this.samples = [];
        this.currentOffset = 0;
        this.isInitialSync = true;
        this.syncCount = 0;
        this.lastSyncTime = 0;
        
        if (this.debugLogging) {
            console.log('[TimeSync] State reset');
        }
    }
    
    /**
     * Check if synchronization is needed (for periodic sync)
     */
    needsSync(maxAge = 30000) { // 30 seconds default
        return Date.now() - this.lastSyncTime > maxAge;
    }
}

// Export for both module and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSync;
} else {
    window.TimeSync = TimeSync;
}