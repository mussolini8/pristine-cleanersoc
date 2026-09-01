const fs = require('fs');
const file = 'src/components/operations/simple-operations-client.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldBtnInner = `<Sparkles className="size-4" /> Copiloto IA (Gemini)`;
const newBtnInner = `<img src="/copiloto-btn.png" alt="Copiloto IA" className="h-8 w-auto object-contain" />`;

content = content.replace(oldBtnInner, newBtnInner);

// Remove padding and bg from the Button
content = content.replace('className="bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"', 'className="p-0 overflow-hidden bg-transparent shadow-md hover:bg-transparent border-0"');

fs.writeFileSync(file, content);
