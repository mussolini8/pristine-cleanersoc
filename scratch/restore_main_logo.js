const fs = require('fs');
const file = 'src/components/dashboard/dashboard-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the logo in aside
const oldImageBlock = `<Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristiner operations">
            <Image
              src="/pristiner-logo.png"
              alt="Pristiner"
              width={150}
              height={150}
              priority
              className="h-auto h-12 w-auto transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>`;

const newImageBlock = `<Link className="group flex min-w-0 items-center" href="/dashboard" aria-label="Pristine Cleaners operations">
            <Image
              src="/logo-full.png"
              alt="Pristine Cleaners"
              width={853}
              height={247}
              priority
              className="h-auto w-[164px] transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </Link>`;

content = content.replace(oldImageBlock, newImageBlock);

// Also restore any "Pristiner" in dashboard-shell.tsx to "Pristine Cleaners"
content = content.replace(/Pristiner operations/g, 'Pristine Cleaners operations');
content = content.replace(/userEmail \?\? "Pristiner"/g, 'userEmail ?? "Pristine Cleaners"');
content = content.replace(/<p className="text-\[11px\] font-semibold text-primary">Pristiner<\/p>/g, '<p className="text-[11px] font-semibold text-primary">Pristine Cleaners</p>');

fs.writeFileSync(file, content);
