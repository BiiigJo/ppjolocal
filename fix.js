const fs = require('fs');
const content = fs.readFileSync('src/components/OutfitGallery.tsx', 'utf8');
const lines = content.split('\n');
// We know the lines are roughly around 370-375
const filteredLines = lines.filter(line => !line.includes('multi_edit_file') && !line.includes('base64:'));
fs.writeFileSync('src/components/OutfitGallery.tsx', filteredLines.join('\n'));
