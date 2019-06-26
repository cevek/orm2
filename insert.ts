import {Table, escapeName, escapeField, DBRaw, Field} from './query.js';

export {};

type Hash = {[key: string]: unknown};
export function insert(
    table: Table,
    dataArr: Hash[],
    params?: {noErrorIfConflict?: Field | boolean},
    parentIds = new Map<Table, number>(),
) {
    let sql = '';
    const afterInsert: {table: Table; data: Hash[]}[] = [];
    const values: unknown[] = [];
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
                    value = insert(field.ref.to.table, [value as Hash], undefined, parentIds);
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
            valuesSql += '$' + values.length;
            values.push(value);
        }
        let onConflictFields = '';
        if (params !== undefined) {
            const {noErrorIfConflict} = params;
            if (noErrorIfConflict === true || typeof noErrorIfConflict === 'object') {
                onConflictFields = ` ON CONFLICT ${
                    noErrorIfConflict === true ? '' : escapeField(noErrorIfConflict)
                } DO NOTHING`;
            }
        }
        sql += `INSERT INTO ${escapeName(
            table.name,
        )} (${namesSql}) VALUES (${valuesSql})${onConflictFields} RETURNING ${escapeField(table.id)};
`;
    }
    console.log(sql, values);
    const id = table.name as any;
    parentIds.set(table, id);
    for (const item of afterInsert) {
        insert(item.table, item.data, undefined, parentIds);
    }
    return id;
}
