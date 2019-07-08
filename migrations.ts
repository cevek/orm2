import {promisify} from 'util';
import {readdir, readFile} from 'fs';
import {sql, joinQueries} from './sqlGenerator';
import {Exception} from './utils';
import {DB} from './createDB';
import {DBRaw} from './types';

async function createMigrationTable(db: DB<unknown>) {
    await db.query(sql`
	 CREATE TABLE IF NOT EXISTS migrations (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL UNIQUE,
		"runAt" TIMESTAMP NOT NULL 
	);
	`);
}

export interface Migration {
    up: string;
    name: string;
}

const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
export async function readMigrationsFromDir(dir: string) {
    const files = await readdirAsync(dir);
    files.sort();
    const migrations: Migration[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const m = file.match(/^\d+ (.*?)\.sql$/);
        if (!m) throw new Exception(`Incorrect migration filename`, {file});
        const migrationName = m[1];
        if (migrations.find(m => m.name === migrationName))
            throw new Exception(`Migration already exists`, {migrationName});
        const up = await readFileAsync(dir + '/' + file, 'utf8');
        migrations.push({name: migrationName, up: up});
    }
    return migrations;
}

export async function migrateUp(db: DB<unknown>, migrations: Migration[]) {
    await db.transaction(async trx => {
        await createMigrationTable(trx);
        const lastAppliedMigration = (await trx.query<{name: string}>(
            sql`SELECT name FROM migrations ORDER BY id DESC LIMIT 1`,
        )).pop();
        if (migrations.length === 0) return;
        let newMigrations = migrations;
        if (lastAppliedMigration) {
            const idx = migrations.findIndex(m => m.name === lastAppliedMigration.name);
            if (idx === -1) throw new Exception(`name is not found in migrations`, {name: lastAppliedMigration.name});
            newMigrations = migrations.slice(idx + 1);
        }
        if (newMigrations.length > 0) {
            for (let i = 0; i < newMigrations.length; i++) {
                const migration = newMigrations[i];
                try {
                    await trx.query(sql`${new DBRaw(migration.up)}`);
                } catch (_err) {
                    const err = _err as Error;
                    const json =
                        err instanceof Exception
                            ? {...err.json, migrationName: migration.name}
                            : {message: err.message};
                    throw new Exception('Migration error', json);
                }
            }
            await trx.query(
                sql`INSERT INTO migrations (name, "runAt") VALUES ${joinQueries(
                    newMigrations.map(m => sql`(${m.name}, ${new Date()})`),
                    sql`,`,
                )}`,
            );
            //todo:
            // logger.info(`Applied new migrations`, {migrations: newMigrations.map(m => m.name)});
        }
    });
}
