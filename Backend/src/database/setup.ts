import pool from '../config/database';
import fs from 'fs';
import path from 'path';

async function runSQLFile(filename: string) {
  const sql = fs.readFileSync(
    path.join(__dirname, filename),
    'utf8'
  );
  
  try {
    await pool.query(sql);
    console.log(`✅ Executed ${filename}`);
  } catch (error) {
    console.error(`❌ Error executing ${filename}:`, error);
    throw error;
  }
}

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...\n');

    // Drop existing tables (if reset is needed)
    const args = process.argv.slice(2);
    if (args.includes('--reset')) {
      console.log('⚠️  Resetting database...');
      await runSQLFile('drop.sql');
    }

    // Create schema
    await runSQLFile('schema.sql');

    // Seed data (if flag provided)
    if (args.includes('--seed')) {
      console.log('🌱 Seeding database...');
      await runSQLFile('seed.sql');
    }

    console.log('\n✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
