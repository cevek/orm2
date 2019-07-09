import {escapeField, escapeTable, Table, val} from './query';
import {DBValue, QueryFun} from './types';
type Hash = {[key: string]: unknown};

export function remove(query: QueryFun, table: Table, data: Hash) {
    const values: DBValue[] = [];
    return query(`DELETE FROM ${escapeTable(table)} WHERE ${escapeField(table.id)}=${val(values, data.id)}`, values);
}
