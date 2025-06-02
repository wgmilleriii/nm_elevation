import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('TOP-LEVEL: Script loaded');

// Configuration
const config = {
    mysql: {
        host: 'localhost',
        port: 3307,
        user: 'root',
        database: 'elevation_tracking'
    },
    logDir: './logs',
    summaryFile: './summary.log'
};

// Create database connection
async function createConnection() {
    return await mysql.createConnection(config.mysql);
}

// Log interaction to database
async function logInteraction(interaction) {
    const conn = await createConnection();
    try {
        await conn.execute(
            'INSERT INTO interactions (actor, command, interpretation, changes_made, efficiency_suggestions, next_steps) VALUES (?, ?, ?, ?, ?, ?)',
            [
                interaction.actor,
                interaction.command,
                interaction.interpretation,
                interaction.changes_made,
                interaction.efficiency_suggestions,
                interaction.next_steps
            ]
        );
    } finally {
        await conn.end();
    }
}

// Generate summary report
async function generateSummary() {
    const conn = await createConnection();
    try {
        console.log('Querying recent interactions...');
        const [interactions] = await conn.execute(
            'SELECT * FROM interactions ORDER BY timestamp DESC LIMIT 10'
        );
        if (!interactions || interactions.length === 0) {
            console.warn('No interactions found.');
        } else {
            console.log(`Found ${interactions.length} interactions.`);
        }

        console.log('Querying pending improvements...');
        const [improvements] = await conn.execute(
            'SELECT * FROM improvements WHERE status != "completed" ORDER BY priority ASC'
        );
        if (!improvements || improvements.length === 0) {
            console.warn('No improvements found.');
        } else {
            console.log(`Found ${improvements.length} improvements.`);
        }

        console.log('Querying recent automation logs...');
        const [automationLogs] = await conn.execute(
            'SELECT * FROM automation_logs ORDER BY timestamp DESC LIMIT 5'
        );
        if (!automationLogs || automationLogs.length === 0) {
            console.warn('No automation logs found.');
        } else {
            console.log(`Found ${automationLogs.length} automation logs.`);
        }

        // Generate summary content
        const summary = {
            timestamp: new Date().toISOString(),
            interactions: interactions,
            improvements: improvements,
            automationLogs: automationLogs
        };

        // Write to summary.log
        console.log('Writing summary to summary.log...');
        const summaryContent = formatSummary(summary);
        fs.writeFileSync(config.summaryFile, summaryContent);
        console.log('summary.log written successfully');

        // Generate HTML report
        console.log('Writing HTML report...');
        const htmlReport = generateHtmlReport(summary);
        fs.writeFileSync('./docs/summary_report.html', htmlReport);
        console.log('HTML report written successfully');

        return summary;
    } finally {
        await conn.end();
    }
}

// Format summary for log file
function formatSummary(summary) {
    return `# Summary Report - ${summary.timestamp}

## Recent Interactions
${summary.interactions.map(i => `
- ${i.timestamp}: ${i.command}
  Changes: ${i.changes_made}
  Suggestions: ${i.efficiency_suggestions}
`).join('\n')}

## Pending Improvements
${summary.improvements.map(i => `
- [${i.status}] ${i.description} (Priority: ${i.priority})
`).join('\n')}

## Recent Automation Logs
${summary.automationLogs.map(l => `
- ${l.timestamp}: ${l.script_name} - ${l.status}
  ${l.message}
`).join('\n')}

---
`;
}

// Generate HTML report
function generateHtmlReport(summary) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Automation Summary Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .section { margin-bottom: 20px; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <h1>Automation Summary Report</h1>
    <p>Generated: ${summary.timestamp}</p>
    
    <div class="section">
        <h2>Recent Interactions</h2>
        ${summary.interactions.map(i => `
            <div class="interaction">
                <h3>${i.timestamp}</h3>
                <p><strong>Command:</strong> ${i.command}</p>
                <p><strong>Changes:</strong> ${i.changes_made}</p>
                <p><strong>Suggestions:</strong> ${i.efficiency_suggestions}</p>
            </div>
        `).join('\n')}
    </div>

    <div class="section">
        <h2>Pending Improvements</h2>
        ${summary.improvements.map(i => `
            <div class="improvement">
                <h3>${i.description}</h3>
                <p>Status: ${i.status} | Priority: ${i.priority}</p>
            </div>
        `).join('\n')}
    </div>

    <div class="section">
        <h2>Automation Logs</h2>
        ${summary.automationLogs.map(l => `
            <div class="log ${l.status}">
                <h3>${l.script_name}</h3>
                <p>Status: ${l.status}</p>
                <p>Message: ${l.message}</p>
                <p>Execution Time: ${l.execution_time}s</p>
            </div>
        `).join('\n')}
    </div>
</body>
</html>`;
}

// Main execution
async function main() {
    try {
        console.log('=== SUMMARY GENERATOR STARTED ===');
        console.log('Current working directory:', process.cwd());
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(config.logDir)) {
            console.log('Creating logs directory...');
            fs.mkdirSync(config.logDir);
        }

        // Ensure docs directory exists
        const docsDir = path.join(__dirname, 'docs');
        if (!fs.existsSync(docsDir)) {
            console.log('Creating docs directory...');
            fs.mkdirSync(docsDir);
        } else {
            console.log('Docs directory already exists:', docsDir);
        }

        // Generate summary
        console.log('Connecting to database...');
        const summary = await generateSummary();
        console.log('Summary generated successfully');

        // Write to summary.log
        try {
            console.log('Writing to summary.log...');
            const summaryContent = formatSummary(summary);
            fs.writeFileSync(config.summaryFile, summaryContent);
            console.log('summary.log written successfully');
        } catch (err) {
            console.error('Failed to write summary.log:', err);
        }

        // Generate HTML report
        try {
            console.log('Generating HTML report...');
            const htmlReport = generateHtmlReport(summary);
            const htmlPath = path.join(docsDir, 'summary_report.html');
            console.log('Resolved HTML report path:', htmlPath);
            fs.writeFileSync(htmlPath, htmlReport);
            console.log('HTML report written successfully at', htmlPath);
        } catch (err) {
            console.error('Failed to write HTML report:', err);
        }

        // Log to automation_logs
        try {
            console.log('Logging to automation_logs...');
            const conn = await createConnection();
            await conn.execute(
                'INSERT INTO automation_logs (script_name, status, message, execution_time) VALUES (?, ?, ?, ?)',
                ['generate_summary.js', 'success', 'Summary generated successfully', 0]
            );
            await conn.end();
            console.log('Automation log entry created successfully');
        } catch (err) {
            console.error('Failed to log to automation_logs:', err);
        }

        console.log('=== SUMMARY GENERATOR DONE ===');

    } catch (error) {
        console.error('Error generating summary:', error);
        // Log error to automation_logs
        try {
            const conn = await createConnection();
            await conn.execute(
                'INSERT INTO automation_logs (script_name, status, message) VALUES (?, ?, ?)',
                ['generate_summary.js', 'failure', error.message]
            );
            await conn.end();
        } catch (err) {
            console.error('Failed to log error to automation_logs:', err);
        }
    }
}

// Run if called directly
console.log('TOP-LEVEL: Calling main() unconditionally');
main().catch(err => {
    console.error('Unhandled error in main:', err);
});

export {
    generateSummary,
    logInteraction
}; 