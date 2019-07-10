import {Table, escapeTable, escapeField, DBRaw, Field, val} from './query';
import {QueryFun, DBValue} from './types';

export {};

type Hash = {[key: string]: unknown};
export async function insert(
    query: QueryFun,
    table: Table,
    dataArr: Hash[],
    params?: {noErrorIfConflict?: DBRaw | boolean},
    parentIds = new Map<Table, number>(),
) {
    let sql = '';
    const afterInsert: {table: Table; data: Hash[]}[] = [];
    const values: DBValue[] = [];
    for (const data of dataArr) {
        let namesSql = '';
        let valuesSql = '';
        for (const key in data) {
            let value = data[key];
            let field = table.fields.get(key);
            if (field === undefined) throw new Error(`${key} doesn't exists in ${table.name}`);
            if (field.ref !== undefined) {
                if (field.ref.collection) {
                    if (Array.isArray(value)) {
                        if (field.ref.through === undefined) {
                            afterInsert.push({table: field.ref.to.table, data: value as Hash[]});
                        } else {
                            const {through, to} = field.ref;
                            afterInsert.push({
                                table: field.ref.to.table,
                                data: value.map(val => ({
                                    [to.name]: 'auto',
                                    [through.name]: val,
                                })),
                            });
                        }
                    } else {
                        throw new Error(`${table.name}"."${field.name}" data should be an array`);
                    }
                    continue;
                } else {
                    value = await insert(query, field.ref.to.table, [value as Hash], undefined, parentIds);
                    field = field.ref.from;
                }
            }
            if (field.idOf !== undefined && value === 'auto') {
                if (field.edge === undefined || data[field.edge.name] === undefined) {
                    value = parentIds.get(field.idOf);
                    if (value === undefined)
                        throw new Error(
                            `No inserts into "${field.idOf.name}" to use as value for "${table.name}"."${field.name}"`,
                        );
                } else continue;
            }

            if (values.length > 0) {
                namesSql += ', ';
                valuesSql += ', ';
            }
            namesSql += escapeField(field);
            valuesSql += val(values, value);
        }
        let onConflictFields = '';
        if (params !== undefined) {
            const {noErrorIfConflict} = params;
            if (noErrorIfConflict === true || typeof noErrorIfConflict === 'object') {
                // todo:
                // const f = noErrorIfConflict === true ? '' : escapeField(noErrorIfConflict);
                // ${f}
                onConflictFields = ` ON CONFLICT DO NOTHING`;
            }
        }
        const tbl = escapeTable(table);
        const idField = escapeField(table.id);
        sql += `INSERT INTO ${tbl} (${namesSql}) VALUES (${valuesSql})${onConflictFields} RETURNING ${idField};`;
    }
    // console.log(sql, values);
    const id = (await query<{id: number}>(sql, values))[0].id;
    parentIds.set(table, id);
    for (const item of afterInsert) {
        // todo: parallel
        await insert(query, item.table, item.data, undefined, parentIds);
    }
    return id;
}
