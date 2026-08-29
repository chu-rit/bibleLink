const fs = require('fs');
const lib = JSON.parse(fs.readFileSync('data/words/bibleWordsLib1.json', 'utf8'));
const terms = JSON.parse(fs.readFileSync('insight_terms3.json', 'utf8'));
const norm = s => s.replace(/[\s-]/g, '');
const normTerms = terms.map(norm);
const notFound = lib.filter(w => {
  const nw = norm(w.word);
  // exact match
  if (normTerms.includes(nw)) return false;
  // prefix match (e.g. "유다" matches "유다,I")
  if (normTerms.some(t => t.startsWith(nw + ',') || t.startsWith(nw + 'I') || t.startsWith(nw + 'II') || t.startsWith(nw + 'III'))) return false;
  return true;
});
console.log('Total words: ' + lib.length);
console.log('Not in insight (after prefix match): ' + notFound.length);
notFound.forEach(w => console.log(w.word + ' | ' + w.id));
