/**
 * Local Supabase backup without Docker/pg_dump (Windows-friendly).
 * Exports public + auth table data as JSON and writes a restore manifest.
 */
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

config({ path: '.env.local' });

const DATABASE_URL = process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) {
  console.error('SUPABASE_DB_URL is missing from .env.local');
  process.exit(1);
}

function parsePostgresUrl(connectionString: string): {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
} {
  const prefix = 'postgresql://';
  if (!connectionString.startsWith(prefix)) {
    throw new Error('SUPABASE_DB_URL must start with postgresql://');
  }

  const withoutScheme = connectionString.slice(prefix.length);
  const atIndex = withoutScheme.lastIndexOf('@');
  if (atIndex === -1) {
    throw new Error('Invalid SUPABASE_DB_URL format');
  }

  const userPass = withoutScheme.slice(0, atIndex);
  const hostPart = withoutScheme.slice(atIndex + 1);
  const colonIndex = userPass.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid SUPABASE_DB_URL user/password format');
  }

  const hostPortDb = hostPart.split('/');
  const database = hostPortDb[1] ?? 'postgres';
  const [host, portStr] = hostPortDb[0].split(':');

  return {
    user: decodeURIComponent(userPass.slice(0, colonIndex)),
    password: decodeURIComponent(userPass.slice(colonIndex + 1)),
    host,
    port: portStr ? Number.parseInt(portStr, 10) : 5432,
    database,
  };
}

const timestamp =
  process.argv[2] ??
  new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

const backupDir = path.join('backups', 'supabase', timestamp);
const dataDir = path.join(backupDir, 'data');

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main(): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true });

  const migrationsSource = path.join('supabase', 'migrations');
  if (fs.existsSync(migrationsSource)) {
    fs.cpSync(migrationsSource, path.join(backupDir, 'migrations'), { recursive: true });
    console.log(`Copied repo migrations -> ${path.join(backupDir, 'migrations')}`);
  }

  const dbConfig = parsePostgresUrl(DATABASE_URL);
  const client = new Client({
    ...dbConfig,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase Postgres');

  try {
    const tablesResult = await client.query<{ schemaname: string; tablename: string }>(
      `
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('public', 'auth')
        ORDER BY schemaname, tablename
      `,
    );

    const manifest: Array<{
      schema: string;
      table: string;
      rows: number;
      file: string;
    }> = [];

    for (const { schemaname, tablename } of tablesResult.rows) {
      const qualified = `${schemaname}.${tablename}`;
      const fileName = `${schemaname}.${tablename}.json`;
      const filePath = path.join(dataDir, fileName);

      const result = await client.query(
        `SELECT * FROM ${quoteIdent(schemaname)}.${quoteIdent(tablename)}`,
      );

      fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2), 'utf8');
      manifest.push({
        schema: schemaname,
        table: tablename,
        rows: result.rowCount ?? result.rows.length,
        file: path.join('data', fileName),
      });

      console.log(`Exported ${qualified} (${result.rowCount ?? result.rows.length} rows)`);
    }

    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          databaseUrlHost: dbConfig.host,
          tables: manifest,
          totalRows: manifest.reduce((sum, entry) => sum + entry.rows, 0),
        },
        null,
        2,
      ),
      'utf8',
    );

    fs.writeFileSync(
      path.join(backupDir, 'README.txt'),
      [
        'Supabase local backup (Node exporter)',
        `Created: ${new Date().toISOString()}`,
        '',
        'Files:',
        '  data/*.json     - row-level exports for public + auth tables',
        '  manifest.json   - table list and row counts',
        '  migrations/     - copy of supabase/migrations from repo at backup time',
        '',
        'Schema source of truth: supabase/migrations/ in the repo.',
        'Member photos are in Cloudflare R2, not included here.',
        '',
        'Restore: import JSON rows back into matching tables on a fresh project,',
        'then re-apply dashboard settings (SMTP, auth providers, cron).',
      ].join('\n'),
      'utf8',
    );

    console.log('');
    console.log(`Backup complete: ${backupDir}`);
    console.log(`Tables: ${manifest.length}, total rows: ${manifest.reduce((s, e) => s + e.rows, 0)}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
