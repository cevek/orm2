import {reservedSQLWords} from './reserved.js';

export type Ref = {from: Field; to: Field; collection: boolean; through: Field | undefined};
export type Field = {
    table: Table;
    tableName: string;
    name: string;
    ref: Ref | undefined;
    idOf: Table | undefined;
    edge: Field | undefined;
    readonly: boolean;
    nullable: boolean;
    hasDefault: boolean;
};
export type Table = {name: string; id: Field; fields: Map<string, Field>};
type Hash = {[key: string]: Hash};
type SubQuery = {ref: Ref; parentFieldName: string; find: Find<unknown, unknown>};
type ParentList = {
    ref: Ref;
    map: Map<number, {[key: string]: unknown[]}>;
    field: string;
    ids: number[];
};

type ExtractField = {
    kind: 'field';
    key: Field;
    value: unknown;
    path: string[];
};
type Group = {
    kind: 'AND' | 'OR';
    group: Group | undefined;
    items: (Group | ExtractField)[];
};

export function query(table: Table, q: Find<unknown>, data: {[key: string]: any}, parent?: ParentList) {
    const tables = new Map<string, {table: Table; a: Field; b: Field}>();
    const subQueries = new Map<string, SubQuery>();
    const selectFields = extractFields(table, q.select, subQueries, tables).items as ExtractField[];
    const conditionGroup = extractFields(table, q.where, subQueries, tables);
    const orders = extractFields(table, q.order, subQueries, tables).items as ExtractField[];
    const values: unknown[] = [];

    let parentIdFieldIdx = -1;
    if (parent !== undefined) {
        parentIdFieldIdx = selectFields.length;
        selectFields.push({
            kind: 'field',
            key: parent.ref.to,
            value: 'skip',
            path: [parent.ref.to.name],
        });
        const condition: ExtractField = {
            kind: 'field',
            key: parent.ref.to,
            value: {in: parent.ids},
            path: [parent.ref.to.name],
        };
        conditionGroup.items.push(condition);
    }

    let idFieldIdx = -1;
    if (subQueries.size > 0) {
        idFieldIdx = selectFields.length;
        selectFields.push({
            kind: 'field',
            key: table.id,
            value: 'skip',
            path: [table.id.name],
        });
    }

    let sql = 'SELECT ';
    if (selectFields.length > 0) {
        const last = selectFields[selectFields.length - 1];
        for (const field of selectFields) {
            sql += escapeField(field.key);
            if (field !== last) {
                sql += ', ';
            }
        }
    }

    sql += ' FROM ' + escapeName(table.name);

    if (parent !== undefined && parent.ref.through !== undefined) {
        sql +=
            ' RIGHT JOIN ' +
            escapeName(parent.ref.to.table.name) +
            ' ON ' +
            escapeField(table.id) +
            '=' +
            escapeField(parent.ref.through.ref!.from);
    }
    for (const [tableName, join] of tables) {
        sql +=
            ' LEFT JOIN ' +
            escapeName(join.table.name) +
            ' ' +
            escapeName(tableName) +
            ' ON ' +
            escapeField(join.a) +
            '=' +
            escapeField(join.b);
    }
    if (conditionGroup.items.length > 0) {
        sql += ' WHERE ';
        function iter(group: Group, level: number) {
            if (level > 0) sql += '(';
            for (let i = 0; i < group.items.length; i++) {
                const item = group.items[i];
                if (i > 0) {
                    sql += ' ' + group.kind + ' ';
                }
                if (item.kind === 'field') {
                    sql += escapeField(item.key);
                } else {
                    iter(item, level + 1);
                }
            }
            if (level > 0) sql += ')';
        }
        iter(conditionGroup, 0);
    }
    if (orders.length > 0) {
        sql += ' ORDER BY ';
        const last = orders[orders.length - 1];
        for (const order of orders) {
            sql += escapeField(order.key) + (order.value === 'desc' ? ' DESC' : ' ASC');
            if (order !== last) {
                sql += ', ';
            }
        }
    }
    if (q.limit !== undefined) {
        sql += ' LIMIT $' + values.length;
        values.push(q.limit);
    }
    if (q.offset !== undefined) {
        sql += ' OFFSET $' + values.length;
        values.push(q.offset);
    }

    console.log({selectFields, conditionGroup, orders, tables, subQueries, sql, values});

    const rawItems: unknown[][] = data[table.name];

    const itemsMap = new Map<number, {[key: string]: unknown[]}>();
    const result = rawItems.map(item => {
        const id = item[idFieldIdx] as number;
        const resultItem = {};
        itemsMap.set(id, resultItem);
        for (let k = 0; k < selectFields.length; k++) {
            const field = selectFields[k];
            if (field.value === 'skip') continue;
            let dest = resultItem as Hash;
            for (let i = 0; i < field.path.length - 1; i++) {
                const part = field.path[i];
                let d = dest[part];
                if (d === undefined) {
                    d = {};
                    dest[part] = d;
                }
                dest = d;
            }
            dest[field.path[field.path.length - 1]] = item[k] as Hash;
        }
        return resultItem as unknown;
    });
    if (subQueries.size > 0) {
        const itemIds = [...itemsMap.keys()];
        for (const [, subQuery] of subQueries) {
            const parent: ParentList = {
                ids: itemIds,
                field: subQuery.parentFieldName,
                map: itemsMap,
                ref: subQuery.ref,
            };
            query(
                subQuery.ref.through ? subQuery.ref.through.ref!.to.table : subQuery.ref.to.table,
                subQuery.find,
                data,
                parent,
            );
        }
    }

    if (parent !== undefined) {
        for (let i = 0; i < result.length; i++) {
            const item = result[i];
            const rawItem = rawItems[i];
            const itemId = rawItem[parentIdFieldIdx] as number;
            const parentItem = parent.map.get(itemId)!;
            let arr = parentItem[parent.field];
            if (arr === undefined) {
                arr = [];
                parentItem[parent.field] = arr;
            }
            arr.push(item);
        }
    }
    return {result, rawItems};
}

function extractFields(
    table: Table,
    obj: Hash | undefined,
    subQueries: Map<string, SubQuery>,
    tables: Map<string, {table: Table; a: Field; b: Field}>,
    group: Group = {kind: 'AND', group: undefined, items: []},
    tableName: string = table.name,
    path: string[] = [],
) {
    if (obj === undefined) return group;
    for (const key in obj) {
        if (key === 'OR' || key === 'AND') {
            const list = (obj[key] as {}) as Hash[];
            const subGroup: Group = {kind: key, group: group, items: []};
            group.items.push(subGroup);
            for (const obj2 of list) {
                extractFields(table, obj2, subQueries, tables, subGroup, tableName, path);
            }
            continue;
        }
        const field = table.fields.get(key);
        if (field === undefined) throw new Error(`${key} doesn't exists in ${table.name}`);
        if (field.ref) {
            const refTableName = tableName ? tableName + '.' + key : key;
            if (field.ref.collection) {
                subQueries.set(refTableName, {
                    ref: field.ref,
                    parentFieldName: key,
                    find: (obj[key] as {}) as Find<unknown>,
                });
            } else {
                tables.set(refTableName, {
                    table: field.ref.to.table,
                    a: createField(tableName, field.ref.from.name, table),
                    b: createField(refTableName, field.ref.to.name, field.ref.to.table),
                });
                extractFields(field.ref.to.table, obj[key], subQueries, tables, group, refTableName, [...path, key]);
            }
        } else {
            const keyValue: ExtractField = {
                kind: 'field',
                key: createField(tableName, field.name, table),
                value: obj[key],
                path: [...path, key],
            };
            group.items.push(keyValue);
        }
    }
    return group;
}

export function createField(tableName: string, name: string, table: Table, ref?: Ref, edge?: Field): Field {
    return {table, tableName, name, ref, idOf: undefined, hasDefault: false, nullable: false, readonly: false, edge};
}

export function createIdField(table: Table): Field {
    return {
        table,
        tableName: table.name,
        name,
        ref: undefined,
        idOf: table,
        edge: undefined,
        hasDefault: true,
        nullable: false,
        readonly: true,
    };
}
export function createRefField(table: Table, name: string, idOf: Table): Field {
    return {
        table,
        tableName: table.name,
        name,
        ref: undefined,
        idOf,
        edge: undefined,
        hasDefault: true,
        nullable: false,
        readonly: true,
    };
}

export function raw(raw: DBQuery) {
    return raw.q;
}
export function escapeName(name: string) {
    return '"' + name + '"';
    // const lowerCase = name.toLowerCase();
    // if (lowerCase !== name || reservedSQLWords.has(lowerCase)) {
    //     return '"' + name + '"';
    // }
    // return name;
}
export function escapeField(field: Field) {
    return escapeName(field.tableName) + '.' + escapeName(field.name);
}
