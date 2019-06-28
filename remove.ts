import {Table, escapeField, escapeTable, val} from './query';
export {};
type Hash = {[key: string]: unknown};

export function remove(table: Table, data: Hash) {
    const values: unknown[] = [];
    const sql = `DELETE FROM ${escapeTable(table)} WHERE ${escapeField(table.id)}=${val(values, data.id)}`;
    console.log(sql, values);
}
