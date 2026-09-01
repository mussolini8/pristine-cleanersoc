const fs = require('fs');

// 1. global-ai-bubble.tsx
{
  const file = 'src/components/ai/global-ai-bubble.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Trigger button
  const triggerRegex = /\{\/\* Floating Trigger Bubble Button \(Bottom Right\) \*\/\}[\s\S]*?\{\/\* Expanded Floating Assistant Drawer \/ Modal \*\/\}/;
  const newTrigger = `{/* Floating Trigger Bubble Button (Bottom Right) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-2.5 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/25 active:scale-95 border-0"
            title="Abrir Pristiner Copiloto IA"
          >
            <div className="relative flex size-6 items-center justify-center">
              <img src="/pristiner-logo.png" alt="Pristiner" className="size-5 object-contain brightness-0 invert" />
            </div>
            <span className="text-xs font-black tracking-wide pr-1">Pristiner Copiloto</span>
          </button>
        </div>
      )}

      {/* Expanded Floating Assistant Drawer / Modal */}`;
  content = content.replace(triggerRegex, newTrigger);

  // Header
  const headerOld = `<h3 className="text-xs font-black text-foreground">Copiloto IA · Pristiner</h3>`;
  const headerNew = `<h3 className="text-xs font-black text-foreground">Pristiner · Copiloto IA</h3>`;
  content = content.replace(headerOld, headerNew);
  
  const iconOld = `<div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-4" />
              </div>`;
  const iconNew = `<div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 p-1">
                <img src="/pristiner-logo.png" alt="Pristiner" className="size-5 object-contain" />
              </div>`;
  content = content.replace(iconOld, iconNew);

  fs.writeFileSync(file, content);
}

// 2. simple-operations-client.tsx
{
  const file = 'src/components/operations/simple-operations-client.tsx';
  let content = fs.readFileSync(file, 'utf8');

  const oldBtn = `<Button
          className="p-0 overflow-hidden bg-transparent shadow-md hover:bg-transparent border-0"
          onClick={() => setIsCopilotOpen(true)}
        >
          <img src="/copiloto-btn.png" alt="Copiloto IA" className="h-8 w-auto object-contain" />
        </Button>`;

  const newBtn = `<Button
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-3.5 py-2 font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-500/20 transition-all border-0"
          onClick={() => setIsCopilotOpen(true)}
        >
          <img src="/pristiner-logo.png" alt="Pristiner" className="size-4 object-contain brightness-0 invert" />
          <span>Pristiner (Copiloto IA)</span>
        </Button>`;

  content = content.replace(oldBtn, newBtn);
  fs.writeFileSync(file, content);
}

// 3. sales-track-client.tsx
{
  const file = 'src/components/commercial/sales-track-client.tsx';
  let content = fs.readFileSync(file, 'utf8');

  const oldBtn = `<Button
              onClick={() => setIsCopilotOpen(true)}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              <Sparkles className="size-4" />
              Copiloto IA (Gemini)
            </Button>`;

  const newBtn = `<Button
              onClick={() => setIsCopilotOpen(true)}
              className="gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
            >
              <img src="/pristiner-logo.png" alt="Pristiner" className="size-4 object-contain brightness-0 invert" />
              Pristiner (Copiloto IA)
            </Button>`;

  content = content.replace(oldBtn, newBtn);
  fs.writeFileSync(file, content);
}

// 4. app/commercial/accounts/page.tsx
{
  const file = 'src/app/commercial/accounts/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    /<Sparkles size=\{14\} \/>\s*Copiloto IA \(Gemini\)/,
    `<img src="/pristiner-logo.png" alt="Pristiner" style={{ width: 16, height: 16, objectFit: "contain", filter: "brightness(0) invert(1)" }} /> Pristiner (Copiloto IA)`
  );
  fs.writeFileSync(file, content);
}

// 5. ai-sop-copilot-modal.tsx
{
  const file = 'src/components/operations/ai-sop-copilot-modal.tsx';
  let content = fs.readFileSync(file, 'utf8');

  const oldModalHeader = `<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">SOP & Sales Copilot (Gemini)</h3>`;

  const newModalHeader = `<div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 p-1.5">
              <img src="/pristiner-logo.png" alt="Pristiner" className="size-7 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Pristiner (Copiloto IA)</h3>`;

  content = content.replace(oldModalHeader, newModalHeader);
  fs.writeFileSync(file, content);
}

console.log('Successfully updated all Copilot branding to Pristiner with circular logo!');
