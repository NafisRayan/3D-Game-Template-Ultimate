/**
 * Performance monitoring utility to track FPS and memory usage
 */
export class PerformanceMonitor {
    constructor(updateInterval = 1000) {
        this.updateInterval = updateInterval;
        this.frames = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.memoryUsage = 0;
        
        this.perfElement = document.getElementById('performance');
        
        // Check if performance.memory is available (Chrome only)
        this.hasMemoryInfo = !!(performance && performance.memory);
        
        // Start monitoring
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Update display periodically
        setInterval(() => this.updateStats(), this.updateInterval);
    }
    
    frameRendered() {
        this.frames++;
    }
    
    updateStats() {
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.lastTime;
        
        // Calculate FPS
        this.fps = Math.round((this.frames * 1000) / elapsedTime);
        
        // Get memory info if available
        if (this.hasMemoryInfo) {
            this.memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
        
        // Reset counters
        this.frames = 0;
        this.lastTime = currentTime;
        
        // Update display
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (this.perfElement) {
            if (this.hasMemoryInfo) {
                this.perfElement.textContent = `FPS: ${this.fps} | Memory: ${this.memoryUsage}MB`;
            } else {
                this.perfElement.textContent = `FPS: ${this.fps}`;
            }
            
            // Color-code based on performance
            if (this.fps < 30) {
                this.perfElement.style.color = '#ff0000';
            } else if (this.fps < 50) {
                this.perfElement.style.color = '#ffff00';
            } else {
                this.perfElement.style.color = '#00ff00';
            }
        }
    }
}
