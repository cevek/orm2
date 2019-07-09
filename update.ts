import {insert} from './insert';
import {escapeField, escapeTable, Ref, Table, val} from './query';
import {remove} from './remove';
import {QueryFun, DBValue} from './types';

export {};
type Hash = {[key: string]: unknown};
export async function update(query: QueryFun, table: Table, data: Hash, idFrom?: {ref: Ref; id: number}) {
    const values: DBValue[] = [];
    let sqlQuery = `UPDATE ${escapeTable(table)} SET `;
    for (const key in data) {
        const value = data[key];
        const field = table.fields.get(key);
        if (field === undefined) throw new Error(`${key} doesn't exists in ${table.name}`);
        if (field === table.id) continue;
        if (field.ref !== undefined) {
            if (field.ref.collection) {
                const {create: createList, update: updateList, remove: removeList} = value as Hash;
                if (field.ref.through === undefined) {
                    const refTable = field.ref.to.table;
                    const {from, to} = field.ref;

                    if (createList !== undefined) {
                        await insert(
                            query,
                            refTable,
                            (createList as Hash[]).map(val => ({
                                ...val,
                                [to.name]: data.id,
                            })),
                        );
                    }
                    if (updateList !== undefined) {
                        for (const item of updateList as Hash[]) {
                            await update(query, refTable, item);
                        }
                    }
                    if (removeList !== undefined) {
                        for (const item of removeList as Hash[]) {
                            await remove(query, field.ref.to.table, item);
                        }
                    }
                } else {
                    const {through, to} = field.ref;
                    const refTable = through.ref!.to.table;
                    if (createList !== undefined) {
                        await insert(
                            query,
                            to.table,
                            (createList as Hash[]).map(val => ({
                                [to.name]: data.id,
                                [through.name]: val,
                            })),
                        );
                    }
                    if (updateList !== undefined) {
                        for (const item of updateList as Hash[]) {
                            await update(query, refTable, item);
                        }
                    }
                    if (removeList !== undefined) {
                        for (const item of removeList as Hash[]) {
                            await remove(query, refTable, item);
                        }
                    }
                }
            } else {
                await update(query, field.ref.to.table, value as Hash, {ref: field.ref, id: data.id as number});
            }
            continue;
        }
        if (values.length > 0) sqlQuery += ', ';
        sqlQuery += `${escapeField(field)}=${val(values, value)}`;
    }
    if (values.length === 0) return;
    sqlQuery += ' WHERE ';
    if (idFrom !== undefined) {
        const from = escapeTable(idFrom.ref.from.table);
        const idField = escapeField(idFrom.ref.from.table.id);
        const tbl = escapeField(idFrom.ref.from);
        sqlQuery += `${escapeField(table.id)}=(SELECT ${tbl} FROM ${from} WHERE ${idField}=${val(values, idFrom.id)})`;
    } else {
        sqlQuery += `${escapeField(table.id)}=${val(values, data.id)}`;
    }
    return query(sqlQuery, values);
}
