import {Collection} from './Collection';
import {sqlGenerator} from './sqlGenerator';
import {DBValue, QueryFun, DBQuery} from './types';
import {maybe, Exception} from './utils';

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

export async function createDB<Schema>(pool: Pool) {
    const doQuery = doQueryFactory(() => pool.connect(), true);
    const db = createDBProxy<Schema>(doQuery);
    db.transaction = async (trx, rollback) => {
        const trxClient = await pool.connect();
        const query = doQueryFactory(async () => trxClient, false);
        try {
            const trxDB = createDBProxy<Schema>(query);
            await trxClient.query('BEGIN');
            await trx(trxDB);
            await trxClient.query('COMMIT');
        } catch (e) {
            await trxClient.query('ROLLBACK');
            if (rollback !== undefined) {
                await rollback();
            }
            throw e;
        } finally {
            trxClient.release();
        }
    };
    return db;
}

function createDBProxy<Schema>(query: QueryFun) {
    type CollectionType = Schema[keyof Schema];
    const db = {query, transaction: {}} as DB<Schema>;
    return new Proxy(db, {
        get(_, key: keyof Schema) {
            const collection = maybe(db[key]);
            if (collection === undefined) {
                const newCollection = new Collection<CollectionType>(key as string, query);
                (db as Collections<Schema>)[key] = newCollection;
                return newCollection;
            }
            return collection;
        },
    });
}

function doQueryFactory(getClient: () => Promise<PoolClient>, release: boolean): QueryFun {
    return async <T>(query: DBQuery) => {
        const client = await getClient();
        const values: DBValue[] = [];
        const sqlQuery = sqlGenerator(query, values);
        let res;
        try {
            res = await client.query(sqlQuery, values);
            if (release) {
                client.release();
            }
        } catch (err) {
            throw new Exception('DB query error', {query: sqlQuery, values, message: (err as Error).message});
        }
        return res.rows as T[];
    };
}
