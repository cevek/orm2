import {Collection} from './Collection';
import {sqlGenerator} from './sqlGenerator';
import {DBValue, DBQuery, QueryFun, Trx} from './types';
import {maybe, Exception} from './utils';
import {Table} from './query';

type Collections<Schema> = {[P in keyof Schema]: Collection<Schema[P]>};

export type DB<Schema> = Collections<Schema> & {
    transaction: TransactionFun<Schema>;
    query: QueryFun;
};

type TransactionFun<Schema> = (trx: (db: DB<Schema>) => Promise<void>, rollback?: () => Promise<void>) => Promise<void>;

type Pool = {connect: () => Promise<PoolClient>};
type PoolClient = {
    release: () => void;
    query: (q: string, values?: unknown[]) => Promise<{rows: unknown[]; command: string}>;
};

export async function createDB<Schema>(pool: Pool, schema: Map<string, Table>) {
    const query = queryFactory(() => pool.connect(), true);
    return _createDB<Schema>(query, schema, async (content, rollback) => {
        const trxClient = await pool.connect();
        const query = queryFactory(async () => trxClient, false);
        try {
            const trxDB = _createDB<Schema>(query, schema, undefined);
            await trxClient.query('BEGIN');
            const res = await content(trxDB);
            await trxClient.query('COMMIT');
            return res;
        } catch (e) {
            await trxClient.query('ROLLBACK');
            if (rollback !== undefined) {
                await rollback();
            }
            throw e;
        } finally {
            trxClient.release();
        }
    });
}

function _createDB<Schema>(query: QueryFun, schema: Map<string, Table>, transaction?: Trx) {
    const db = {query, transaction} as {};
    for (const [tableName, table] of schema) {
        (db as {[key: string]: Collection<unknown>})[tableName] = new Collection(tableName, table, query, transaction);
    }
    return db as DB<Schema>;
}

function queryFactory(getClient: () => Promise<PoolClient>, release: boolean): QueryFun {
    return async <T>(sql: string, values?: DBValue[]) => {
        const client = await getClient();
        let res;
        try {
            res = await client.query(sql, values);
            if (release) {
                client.release();
            }
        } catch (err) {
            throw new Exception('DB query error', {sql, values, message: (err as Error).message});
        }
        return res.rows as T[];
    };
}
