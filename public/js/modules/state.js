// State management for the viewer
export class ViewerState {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.standingPoint = null;
        this.lookingPoint = null;
        this.square = null;
        this.circle = null;
        this.arc = null;
        this.profile = null;
        this.loading = false;
        this.arcPointMarkers = [];
    }
    
    setLoading(loading) {
        this.loading = loading;
        document.body.style.cursor = loading ? 'wait' : 'default';
    }
    
    clearMapLayers(map) {
        if (this.square) map.removeLayer(this.square);
        if (this.circle) map.removeLayer(this.circle);
        if (this.arc) map.removeLayer(this.arc);
        this.arcPointMarkers.forEach(marker => map.removeLayer(marker));
        this.arcPointMarkers = [];
    }
    
    clearSVG(svg) {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
    }
    
    clearTable() {
        document.querySelector('#pointsTable tbody').innerHTML = '';
    }
    
    clearAll(map, svg) {
        this.clearMapLayers(map);
        this.clearSVG(svg);
        this.clearTable();
        this.reset();
    }
} 