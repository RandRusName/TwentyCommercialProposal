import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });

const files = walk(srcRoot).filter((file) =>
  sourceExtensions.has(path.extname(file)),
);
const failures = [];

const importsOf = (source) =>
  [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );

const moduleFromPath = (value) => {
  const normalized = value.replaceAll('\\', '/');
  const match = normalized.match(/(?:^|\/)modules\/([^/]+)/);
  return match?.[1] ?? null;
};

const moduleGraph = new Map();

for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  const imports = importsOf(source);
  const owner = moduleFromPath(relative);

  if (relative.startsWith('src/platform/')) {
    for (const imported of imports) {
      if (imported.startsWith('src/modules/')) {
        failures.push(`${relative}: platform cannot import ${imported}`);
      }
    }
  }

  if (owner !== null) {
    const dependencies = moduleGraph.get(owner) ?? new Set();
    for (const imported of imports) {
      const dependency = moduleFromPath(imported);
      if (dependency !== null && dependency !== owner) dependencies.add(dependency);
    }
    moduleGraph.set(owner, dependencies);
  }

  if (['catalog', 'documents', 'sales'].includes(owner ?? '')) {
    for (const imported of imports) {
      if (imported.startsWith('src/modules/commercial-proposals/')) {
        failures.push(`${relative}: ${owner} cannot import Commercial Proposals`);
      }
    }
  }

  if (relative.match(/^src\/modules\/[^/]+\/domain\//)) {
    const forbidden = imports.filter(
      (imported) =>
        imported.startsWith('twenty-sdk') ||
        imported.startsWith('twenty-client-sdk') ||
        imported === 'react' ||
        imported.startsWith('react/'),
    );
    if (forbidden.length > 0 || source.includes('process.env')) {
      failures.push(`${relative}: module domain must stay platform-independent`);
    }
  }
}

const visit = (module, trail = []) => {
  if (trail.includes(module)) {
    failures.push(`module cycle: ${[...trail, module].join(' -> ')}`);
    return;
  }
  for (const dependency of moduleGraph.get(module) ?? []) {
    visit(dependency, [...trail, module]);
  }
};
for (const module of moduleGraph.keys()) visit(module);

const requireText = (relative, expected) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  if (!source.includes(expected)) {
    failures.push(`${relative}: missing architecture contract ${expected}`);
  }
};

requireText(
  'src/logic-functions/generate-commercial-proposal.logic-function.ts',
  'src/modules/documents/infrastructure/http-document-service.adapter',
);
requireText(
  'src/logic-functions/get-opportunity-context.logic-function.ts',
  'src/modules/sales/infrastructure/twenty-sales-context.adapter',
);
requireText(
  'src/logic-functions/search-catalog-items.logic-function.ts',
  'src/modules/catalog/infrastructure/twenty-catalog-query.adapter',
);

if (failures.length > 0) {
  console.error('Architecture checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Architecture checks passed for ${files.length} TypeScript source files and ${moduleGraph.size} module boundaries.`,
);
