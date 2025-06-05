const express = require('express');
const path = require('path');
const app = express();
const port = 8020;

// Serve static files from the public directory
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 