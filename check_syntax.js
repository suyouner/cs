const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
    const scriptContent = scriptMatch[1];
    fs.writeFileSync('temp_script.js', scriptContent);
    try {
        require('vm').runInNewContext(scriptContent);
        console.log("No syntax errors found.");
    } catch (e) {
        console.error("Syntax error:", e);
    }
} else {
    console.log("No script tag found.");
}
