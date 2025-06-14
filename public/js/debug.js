export class DebugTerminal {
    constructor() {
        this.settings = {
            verbose: false,
            info: true,
            warning: true
        };
        
        this.createUI();
        this.attachEventListeners();
    }
    
    createUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'debug-container';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'debug-header';
        
        const title = document.createElement('span');
        title.className = 'debug-title';
        title.textContent = 'Debug Terminal';
        
        const controls = document.createElement('div');
        controls.className = 'debug-controls';
        
        // Create checkboxes
        const checkboxGroup = document.createElement('div');
        checkboxGroup.className = 'debug-checkbox-group';
        
        ['verbose', 'info', 'warning'].forEach(level => {
            const label = document.createElement('label');
            label.className = 'debug-checkbox-label';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.settings[level];
            checkbox.dataset.level = level;
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(level.charAt(0).toUpperCase() + level.slice(1)));
            checkboxGroup.appendChild(label);
        });
        
        controls.appendChild(checkboxGroup);
        
        header.appendChild(title);
        header.appendChild(controls);
        
        // Create content area
        this.content = document.createElement('div');
        this.content.className = 'debug-content';
        
        // Assemble container
        this.container.appendChild(header);
        this.container.appendChild(this.content);
        
        // Create global toggle button
        this.globalToggle = document.createElement('button');
        this.globalToggle.id = 'debug-global-toggle';
        this.globalToggle.textContent = 'Debug';
        
        // Add to document
        document.body.appendChild(this.container);
        document.body.appendChild(this.globalToggle);
        
        // Initial state
        this.container.classList.add('hidden');
    }
    
    attachEventListeners() {
        // Toggle visibility using header or global toggle
        this.container.querySelector('.debug-header').addEventListener('click', () => {
            this.toggleVisibility();
        });
        
        this.globalToggle.addEventListener('click', () => {
            this.toggleVisibility();
        });
        
        // Level toggles
        this.container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation(); // Prevent header click
                const level = e.target.dataset.level;
                this.settings[level] = e.target.checked;
                this.updateVisibility();
            });
        });
        
        // Prevent checkbox clicks from triggering header
        this.container.querySelector('.debug-controls').addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    toggleVisibility() {
        this.container.classList.toggle('hidden');
        this.globalToggle.textContent = this.container.classList.contains('hidden') ? 'Debug' : 'Hide Debug';
    }
    
    updateVisibility() {
        this.content.querySelectorAll('.debug-line').forEach(line => {
            const level = line.dataset.level;
            line.style.display = this.settings[level] ? 'block' : 'none';
        });
    }
    
    log(level, message, data = null) {
        const line = document.createElement('div');
        line.className = 'debug-line';
        line.dataset.level = level;
        
        const label = document.createElement('span');
        label.className = `log-label log-${level}`;
        label.textContent = level.toUpperCase();
        
        const text = document.createElement('span');
        text.className = `log-${level}`;
        text.textContent = message;
        
        line.appendChild(label);
        line.appendChild(text);
        
        if (data) {
            const dataText = document.createElement('pre');
            dataText.className = `log-${level}`;
            dataText.textContent = '\n' + JSON.stringify(data, null, 2);
            line.appendChild(dataText);
        }
        
        this.content.appendChild(line);
        this.content.scrollTop = this.content.scrollHeight;
        
        if (!this.settings[level]) {
            line.style.display = 'none';
        }
    }
    
    verbose(message, data = null) {
        this.log('verbose', message, data);
    }
    
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    warning(message, data = null) {
        this.log('warning', message, data);
    }
    
    error(message, data = null) {
        this.log('error', message, data);
    }
} 