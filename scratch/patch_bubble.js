const fs = require('fs');
const file = 'src/components/ai/global-ai-bubble.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldBtn = `<div className="relative flex size-6 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-40" />
              <Sparkles className="size-5 text-white" />
            </div>
            <span className="text-xs font-black tracking-wide pr-1">Copiloto SOP</span>`;

const newBtn = `<img src="/copiloto-btn.png" alt="Copiloto IA (Gemini)" className="h-10 w-auto rounded-full object-contain" />`;

content = content.replace(oldBtn, newBtn);

// Remove the padding and bg from the button wrapper so the image handles it
content = content.replace('bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-3 text-white shadow-2xl', 'p-0 bg-transparent shadow-2xl overflow-hidden');

fs.writeFileSync(file, content);
