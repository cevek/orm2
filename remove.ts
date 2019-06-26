import {Table, escapeField, escapeName} from './query.js';
export {};
type Hash = {[key: string]: unknown};

export function remove(table: Table, data: Hash) {
    const values: unknown[] = [];
    const sql = `DELETE FROM ${escapeName(table.name)} WHERE ${escapeField(table.id)}=$${values.length}`;
    values.push(data.id);
    console.log(sql, values);
}
