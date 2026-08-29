const fs = require('fs');
const html = fs.readFileSync('insight_index.html', 'utf8');
const terms = new Set();
const re = /<option[^>]*value="([^"]+)"[^>]*data-url="([^"]+)"/g;
let m;
while ((m = re.exec(html)) !== null) {
  terms.add(m[1].trim());
}
console.log('Total terms: ' + terms.size);
fs.writeFileSync('insight_terms3.json', JSON.stringify([...terms]));
