/**
 * Horizon Renderer
 * Renders multi-layered horizon views with atmospheric depth effects
 */
export class HorizonRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || 380,
            height: options.height || 180,
            layers: options.layers || 7,
            atmosphericEffect: options.atmosphericEffect !== false,
            colorScheme: options.colorScheme || 'default',
            showGrid: options.showGrid !== false,
            showLabels: options.showLabels !== false,
            showRings: options.showRings !== false,
            maxDistance: options.maxDistance || 50000, // meters
            maxElevation: options.maxElevation || 4500, // meters
            verticalExaggeration: options.verticalExaggeration || 2.0
        };

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.layers = [];
        this.clickHandler = null;
        this.setupEventListeners();
        this.createColorGradients();
    }

    createColorGradients() {
        this.colorSchemes = {
            default: {
                sky: ['#87CEEB', '#4A90E2', '#2C3E50'],
                terrain: ['#8B4513', '#A0522D', '#6B8E23', '#556B2F'],
                atmosphere: ['rgba(255,255,255,0.2)', 'rgba(200,200,255,0.4)']
            },
            sunset: {
                sky: ['#FF7F50', '#FF6B6B', '#4A90E2'],
                terrain: ['#4A4A4A', '#6B4423', '#8B4513'],
                atmosphere: ['rgba(255,200,150,0.3)', 'rgba(255,150,150,0.4)']
            },
            night: {
                sky: ['#1A1A2A', '#2C3E50', '#34495E'],
                terrain: ['#2C3E50', '#34495E', '#2C3E50'],
                atmosphere: ['rgba(100,100,150,0.2)', 'rgba(50,50,100,0.3)']
            }
        };
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            if (this.clickHandler) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const bearing = (x / this.options.width) * 360;
                const elevation = ((this.options.height - y) / this.options.height) * this.options.maxElevation;
                this.clickHandler(bearing, elevation, {x, y});
            }
        });
    }

    setClickHandler(handler) {
        this.clickHandler = handler;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.options.width, this.options.height);
    }

    render(elevationData) {
        this.clear();
        
        // Draw sky gradient
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.options.height);
        const scheme = this.colorSchemes[this.options.colorScheme];
        scheme.sky.forEach((color, i) => {
            skyGradient.addColorStop(i / (scheme.sky.length - 1), color);
        });
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.options.width, this.options.height);

        // Draw terrain layers
        if (elevationData && elevationData.length > 0) {
            this.renderTerrainLayers(elevationData);
        }

        // Draw grid if enabled
        if (this.options.showGrid) {
            this.drawGrid();
        }

        // Draw labels if enabled
        if (this.options.showLabels) {
            this.drawLabels();
        }

        // Draw distance rings if enabled
        if (this.options.showRings) {
            this.drawDistanceRings();
        }
    }

    renderTerrainLayers(elevationData) {
        const scheme = this.colorSchemes[this.options.colorScheme];
        
        // Calculate scales
        const xScale = this.options.width / 360;
        const yScale = this.options.height / this.options.maxElevation;

        // Draw each layer with atmospheric depth effect
        for (let i = 0; i < this.options.layers; i++) {
            const depth = i / (this.options.layers - 1);
            const alpha = 1 - (depth * 0.7); // Fade out distant layers
            const terrainColor = scheme.terrain[i % scheme.terrain.length];
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.options.height);
            
            elevationData.forEach((elev, x) => {
                const scaledElev = elev * this.options.verticalExaggeration * (1 - depth * 0.3);
                const y = this.options.height - (scaledElev * yScale);
                this.ctx.lineTo(x * xScale, y);
            });
            
            this.ctx.lineTo(this.options.width, this.options.height);
            this.ctx.closePath();
            
            // Fill with semi-transparent color
            this.ctx.fillStyle = this.adjustColorAlpha(terrainColor, alpha);
            this.ctx.fill();
        }
    }

    adjustColorAlpha(color, alpha) {
        if (color.startsWith('rgba')) {
            return color.replace(/[\d.]+\)$/g, `${alpha})`);
        }
        if (color.startsWith('rgb')) {
            return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
        }
        return color;
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 1;

        // Draw vertical lines every 30 degrees
        for (let deg = 0; deg <= 360; deg += 30) {
            const x = (deg / 360) * this.options.width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.options.height);
            this.ctx.stroke();
        }

        // Draw horizontal lines every 500m
        for (let elev = 0; elev <= this.options.maxElevation; elev += 500) {
            const y = this.options.height - (elev / this.options.maxElevation) * this.options.height;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.options.width, y);
            this.ctx.stroke();
        }
    }

    drawLabels() {
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';

        // Draw bearing labels
        for (let deg = 0; deg <= 360; deg += 30) {
            const x = (deg / 360) * this.options.width;
            this.ctx.fillText(`${deg}°`, x, this.options.height - 5);
        }

        // Draw elevation labels
        this.ctx.textAlign = 'right';
        for (let elev = 0; elev <= this.options.maxElevation; elev += 500) {
            const y = this.options.height - (elev / this.options.maxElevation) * this.options.height;
            this.ctx.fillText(`${elev}m`, this.options.width - 5, y + 3);
        }
    }

    drawDistanceRings() {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        this.ctx.setLineDash([5, 5]);

        const distances = [1000, 5000, 10000, 20000, 50000];
        distances.forEach(distance => {
            const y = this.options.height * (1 - distance / this.options.maxDistance);
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.options.width, y);
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            this.ctx.fillText(`${distance/1000}km`, 5, y - 2);
        });
        
        this.ctx.setLineDash([]);
    }
} 