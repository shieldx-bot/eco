"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function runSQLFile(filename) {
    const sql = fs_1.default.readFileSync(path_1.default.join(__dirname, filename), 'utf8');
    try {
        await database_1.default.query(sql);
        console.log(`✅ Executed ${filename}`);
    }
    catch (error) {
        console.error(`❌ Error executing ${filename}:`, error);
        throw error;
    }
}
async function setupDatabase() {
    try {
        console.log('🔧 Setting up database...\n');
        const args = process.argv.slice(2);
        if (args.includes('--reset')) {
            console.log('⚠️  Resetting database...');
            await runSQLFile('drop.sql');
        }
        await runSQLFile('schema.sql');
        if (args.includes('--seed')) {
            console.log('🌱 Seeding database...');
            await runSQLFile('seed.sql');
        }
        console.log('\n✅ Database setup complete!');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Database setup failed:', error);
        process.exit(1);
    }
}
setupDatabase();
//# sourceMappingURL=setup.js.map