import {Table, escapeField, escapeTable, sql, Ref, val} from './query.js';
import {remove} from './remove.js';
import {insert} from './insert.js';

export {};
type Hash = {[key: string]: unknown};
export function update(table: Table, data: Hash, idFrom?: {ref: Ref; id: number}) {
    const values: unknown[] = [];
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
                        insert(
                            refTable,
                            (createList as Hash[]).map(val => ({
                                ...val,
                                [to.name]: data.id,
                            })),
                        );
                    }
                    if (updateList !== undefined) {
                        for (const item of updateList as Hash[]) {
                            update(refTable, item);
                        }
                    }
                    if (removeList !== undefined) {
                        for (const item of removeList as Hash[]) {
                            remove(field.ref.to.table, item);
                        }
                    }
                } else {
                    const {through, to} = field.ref;
                    const refTable = through.ref!.to.table;
                    if (createList !== undefined) {
                        insert(
                            to.table,
                            (createList as Hash[]).map(val => ({
                                [to.name]: data.id,
                                [through.name]: val,
                            })),
                        );
                    }
                    if (updateList !== undefined) {
                        for (const item of updateList as Hash[]) {
                            update(refTable, item);
                        }
                    }
                    if (removeList !== undefined) {
                        for (const item of removeList as Hash[]) {
                            remove(refTable, item);
                        }
                    }
                }
            } else {
                update(field.ref.to.table, value as Hash, {ref: field.ref, id: data.id as number});
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
    console.log(sqlQuery, values);
}
